"""Hourly public metrics refresh. All-or-nothing; reviewed evidence is immutable here."""
import concurrent.futures
import copy
import datetime
import json
import os
import time
from pathlib import Path
import runpy

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "app/data/youtube-creators.json"
EXPECTED_CREATOR_ENTRIES = 12
MINIMUM_REFRESH_INTERVAL = datetime.timedelta(minutes=55)

def validate_refresh_scope(payload):
    creators = payload.get('creators', [])
    channels = payload.get('channels', [])
    if len(creators) != EXPECTED_CREATOR_ENTRIES:
        raise ValueError(f"Expected {EXPECTED_CREATOR_ENTRIES} creator entries, found {len(creators)}")
    channel_ids = [channel.get('id') for channel in channels]
    if not channel_ids or len(channel_ids) != len(set(channel_ids)):
        raise ValueError("Channel IDs must be present and unique")
    referenced_ids = {creator.get('channelId') for creator in creators}
    if None in referenced_ids or referenced_ids != set(channel_ids):
        raise ValueError("Every creator entry must reference exactly one collected channel")
    return len(creators), len(channels)

def refresh_due(payload, now=None, force=False):
    if force:
        return True
    checked_at = payload.get('lastSuccessfulRefreshAt')
    if not checked_at:
        return True
    current = now or datetime.datetime.now(datetime.timezone.utc)
    previous = datetime.datetime.fromisoformat(checked_at)
    return current - previous.astimezone(datetime.timezone.utc) >= MINIMUM_REFRESH_INTERVAL

def collection_complete(channel, fresh):
    videos = fresh.get('videos', [])
    public_counts = [fresh.get('subscribers'), fresh.get('totalViews'), *[video.get('views') for video in videos]]
    return (
        not fresh.get('errors')
        and fresh.get('channelId') == channel['id']
        and fresh.get('longComplete') is True
        and fresh.get('shortComplete') is True
        and len(videos) == fresh.get('videoCount')
        and len({video.get('id') for video in videos}) == len(videos)
        and all(isinstance(value, (int, float)) and value >= 0 for value in public_counts)
    )

def collect_with_retry(channel, collect, attempts=3, pause=time.sleep):
    fresh = None
    for attempt in range(attempts):
        fresh = collect(channel['url'])
        if collection_complete(channel, fresh):
            return fresh
        if attempt + 1 < attempts:
            pause(2 ** attempt)
    return fresh

def merge_channel(old, fresh, shared=False):
    if fresh.get("errors") or fresh.get("channelId") != old["id"]:
        raise ValueError(f"Channel unavailable or identity mismatch: {old['id']}")
    videos = fresh.get("videos", [])
    if not fresh.get("longComplete") or not fresh.get("shortComplete") or len(videos) != fresh.get("videoCount"):
        raise ValueError(f"Incomplete public catalog: {old['id']}")
    if len({v['id'] for v in videos}) != len(videos):
        raise ValueError("Duplicate public video IDs")
    for value in [fresh.get("subscribers"), fresh.get("totalViews"), *[v.get("views") for v in videos]]:
        if not isinstance(value, (int, float)) or value < 0:
            raise ValueError(f"Missing public counts: {old['id']}")
    if any(v.get("kind") not in ("long", "short") for v in videos):
        raise ValueError("Unknown video format")
    result = copy.deepcopy(old)
    result.update(previousSubscribers=old.get('subscribers'), previousCheckedAt=old.get('checkedAt'))
    result.update(subscribers=fresh['subscribers'], totalViews=fresh['totalViews'], videoCount=len(videos), viewsSample=len(videos),
                  averageViews=round(sum(v['views'] for v in videos)/len(videos)) if videos else None)
    for kind in ('long', 'short'):
        group = [v for v in videos if v['kind'] == kind]
        result[kind] = dict(count=len(group), viewsSample=len(group), averageViews=round(sum(v['views'] for v in group)/len(group)) if group else None)
    if shared:
        reviewed = {v['id']:v for v in old['sharedVideos']}
        result['sharedVideos'] = [dict(id=v['id'], title=v['title'], kind=v['kind'], views=v['views'],
            names=reviewed.get(v['id'], {}).get('names', []),
            basis=reviewed.get(v['id'], {}).get('basis', '출연자 이름 근거 미확인')) for v in videos]
    return result

def daily_close(original, checked):
    kst = datetime.timezone(datetime.timedelta(hours=9))
    date = datetime.datetime.fromisoformat(checked).astimezone(kst).date()
    saved = original.get('dailyClose')
    if saved and saved.get('date') == date.isoformat():
        return saved
    latest = min(datetime.datetime.fromisoformat(c['checkedAt']) for c in original['channels'])
    if latest.astimezone(kst).date() != date - datetime.timedelta(days=1):
        return dict(date=date.isoformat(), subscribers=None, videos=None, checkedAt=None, channelSubscribers={})
    return dict(date=date.isoformat(), subscribers=sum(c['subscribers'] for c in original['channels']),
                videos=sum(c['long']['count'] + c['short']['count'] for c in original['channels']), checkedAt=latest.isoformat(),
                channelSubscribers={c['id']:c['subscribers'] for c in original['channels']})

def main():
    original = json.loads(TARGET.read_text(encoding='utf-8'))
    creator_count, channel_count = validate_refresh_scope(original)
    checked_at = datetime.datetime.now(datetime.timezone.utc)
    force = os.environ.get('FORCE_YOUTUBE_REFRESH') == '1'
    if not refresh_due(original, checked_at, force):
        print(f"Latest complete snapshot is less than {MINIMUM_REFRESH_INTERVAL.seconds // 60} minutes old; skipping.")
        return
    collect = runpy.run_path(str(ROOT / 'scripts/collect-youtube-channels.py'))['collect']
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda channel: collect_with_retry(channel, collect), original['channels']))
    updated = copy.deepcopy(original)
    updated['channels'] = [merge_channel(old, fresh, sum(p['channelId']==old['id'] for p in original['creators'])>1)
                           for old, fresh in zip(original['channels'], results)]
    checked = checked_at.isoformat()
    updated['dailyClose'] = daily_close(original, checked)
    updated['lastSuccessfulRefreshAt'] = checked
    for channel in updated['channels']:
        channel['checkedAt'] = checked
    assert updated['creators'] == original['creators'] and updated['evidence'] == original['evidence']
    # Only publish after EVERY channel has passed validation. Errors leave the file untouched.
    TARGET.write_text(json.dumps(updated, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(f"Verified all {creator_count} creator entries across {channel_count} unique channels at {checked}")

if __name__ == '__main__':
    main()
