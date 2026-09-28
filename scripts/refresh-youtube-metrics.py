"""Hourly public metrics refresh. All-or-nothing; reviewed evidence is immutable here."""
import concurrent.futures
import copy
import datetime
import json
import os
import re
import time
import unicodedata
from pathlib import Path
import runpy

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "app/data/youtube-creators.json"
EXPECTED_CREATOR_ENTRIES = 15
MINIMUM_REFRESH_INTERVAL = datetime.timedelta(minutes=55)
VOLVO_MODELS = r'(?:EX30|EX40|EX90|EC40|ES90|XC40|XC60|XC70|XC90|S60|S90|V40|V60CC|V60|V90CC|V90|C40)'
VOLVO_VIDEO_TITLE = re.compile(
    rf'(?:볼보|VOLVO|(?<![A-Z0-9]){VOLVO_MODELS}(?![A-Z0-9]))',
    re.IGNORECASE,
)
VOLVO_MODEL_TITLE = re.compile(
    rf'(?<![A-Z0-9]){VOLVO_MODELS}(?![A-Z0-9])',
    re.IGNORECASE,
)
AUTOMOTIVE_TITLE = re.compile(
    r'(?:출고|전시장|사전계약|차량|자동차|안전|SUV|세단|전기차|내연기관|가격|오너|유리창|시승|주행|충전|배터리|옵션|트림|보증|서비스\s*센터|차박|트렁크|주차|운전|사고|프로모션|계약|상담|사운드|오디오|스피커)',
    re.IGNORECASE,
)
LIFESTYLE_TITLE = re.compile(
    r'(?:맛집|먹방|먹거리|순대국|닭갈비|갈비|소고기|삼겹살|여행|마실|데이트|요리|러닝|트레킹|축제|커버|cover|노래|밴드|카레|떡볶이|카페|coffee|콘서트|브이로그|vlog|결혼식|신랑입장|웨이팅|일상)',
    re.IGNORECASE,
)

def normalized_video_title(video):
    return unicodedata.normalize('NFC', video.get('title', ''))

def scoped_videos(channel, videos):
    scope = channel.get('videoBrandFilter')
    if not scope:
        return videos
    if scope != 'volvo':
        raise ValueError(f"Unknown video brand filter: {scope}")
    include_ids = set(channel.get('videoScopeIncludeIds', []))
    exclude_ids = set(channel.get('videoScopeExcludeIds', []))
    selected = []
    for video in videos:
        video_id = video.get('id')
        if video_id in exclude_ids:
            continue
        title = normalized_video_title(video)
        if video_id in include_ids or VOLVO_VIDEO_TITLE.search(title):
            selected.append(video)
    if channel.get('videoContentFilter') == 'automotive':
        selected = [video for video in selected if (
            video.get('id') in include_ids
            or not LIFESTYLE_TITLE.search(normalized_video_title(video))
            or VOLVO_MODEL_TITLE.search(normalized_video_title(video))
            or AUTOMOTIVE_TITLE.search(normalized_video_title(video))
        )]
    return selected

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
    if any(channel.get('videoBrandFilter') != 'volvo' for channel in channels):
        raise ValueError("Every channel must use the Volvo-only video filter")
    if any(channel.get('videoContentFilter') != 'automotive' for channel in channels):
        raise ValueError("Every channel must exclude non-automotive lifestyle videos")
    for channel in channels:
        include_ids = channel.get('videoScopeIncludeIds', [])
        exclude_ids = channel.get('videoScopeExcludeIds', [])
        if not all(isinstance(ids, list) and all(isinstance(video_id, str) and video_id for video_id in ids)
                   for ids in (include_ids, exclude_ids)):
            raise ValueError("Video scope overrides must be lists of video IDs")
        if len(include_ids) != len(set(include_ids)) or len(exclude_ids) != len(set(exclude_ids)):
            raise ValueError("Video scope override IDs must be unique")
        if set(include_ids) & set(exclude_ids):
            raise ValueError("A video cannot be both included and excluded")
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
    selected = scoped_videos(channel, videos)
    public_counts = [fresh.get('subscribers'), *[video.get('views') for video in selected]]
    if not channel.get('videoBrandFilter'):
        public_counts.append(fresh.get('totalViews'))
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
    all_videos = fresh.get("videos", [])
    if not fresh.get("longComplete") or not fresh.get("shortComplete") or len(all_videos) != fresh.get("videoCount"):
        raise ValueError(f"Incomplete public catalog: {old['id']}")
    if len({v['id'] for v in all_videos}) != len(all_videos):
        raise ValueError("Duplicate public video IDs")
    videos = scoped_videos(old, all_videos)
    values = [fresh.get("subscribers"), *[v.get("views") for v in videos]]
    if not old.get('videoBrandFilter'):
        values.append(fresh.get("totalViews"))
    for value in values:
        if not isinstance(value, (int, float)) or value < 0:
            raise ValueError(f"Missing public counts: {old['id']}")
    if any(v.get("kind") not in ("long", "short") for v in videos):
        raise ValueError("Unknown video format")
    result = copy.deepcopy(old)
    result.update(previousSubscribers=old.get('subscribers'), previousCheckedAt=old.get('checkedAt'))
    total_views = sum(v['views'] for v in videos) if old.get('videoBrandFilter') else fresh['totalViews']
    result.update(subscribers=fresh['subscribers'], totalViews=total_views, videoCount=len(videos), viewsSample=len(videos),
                  averageViews=round(sum(v['views'] for v in videos)/len(videos)) if videos else None)
    for kind in ('long', 'short'):
        group = [v for v in videos if v['kind'] == kind]
        result[kind] = dict(count=len(group), viewsSample=len(group), averageViews=round(sum(v['views'] for v in group)/len(group)) if group else None)
    if old.get('videoBrandFilter'):
        result['scopeVideoIds'] = [v['id'] for v in videos]
    if shared:
        reviewed = {v['id']:v for v in old['sharedVideos']}
        result['sharedVideos'] = [dict(id=v['id'], title=v['title'], kind=v['kind'], views=v['views'],
            names=reviewed.get(v['id'], {}).get('names', []),
            basis=reviewed.get(v['id'], {}).get('basis', '출연자 이름 근거 미확인')) for v in videos]
    return result

def daily_close(original, checked, channels=None, capture=False):
    kst = datetime.timezone(datetime.timedelta(hours=9))
    local_checked = datetime.datetime.fromisoformat(checked).astimezone(kst)
    date = local_checked.date()
    # The close job is scheduled for 23:59 KST to avoid GitHub's busy top-of-hour
    # window. If it starts before midnight it belongs to the following day; if
    # GitHub delays it past midnight, it belongs to the current day.
    if capture and local_checked.hour >= 12:
        date += datetime.timedelta(days=1)
    saved = original.get('dailyClose')
    if saved and saved.get('date') == date.isoformat() and saved.get('checkedAt'):
        return saved
    if capture:
        snapshot = channels if channels is not None else original['channels']
        return dict(date=date.isoformat(), subscribers=sum(c['subscribers'] for c in snapshot),
                    videos=sum(c['long']['count'] + c['short']['count'] for c in snapshot), checkedAt=checked,
                    channelSubscribers={c['id']:c['subscribers'] for c in snapshot})
    if saved and saved.get('date') == date.isoformat():
        return saved
    # Never substitute an arbitrary previous-day collection for the midnight close.
    # The dedicated 00:00 KST workflow is the only writer of a populated baseline.
    return dict(date=date.isoformat(), subscribers=None, videos=None, checkedAt=None, channelSubscribers={})

def main():
    original = json.loads(TARGET.read_text(encoding='utf-8'))
    creator_count, channel_count = validate_refresh_scope(original)
    checked_at = datetime.datetime.now(datetime.timezone.utc)
    capture_close = os.environ.get('CAPTURE_YOUTUBE_DAILY_CLOSE') == '1'
    force = os.environ.get('FORCE_YOUTUBE_REFRESH') == '1' or capture_close
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
    updated['dailyClose'] = daily_close(original, checked, updated['channels'], capture_close)
    updated['lastSuccessfulRefreshAt'] = checked
    for channel in updated['channels']:
        channel['checkedAt'] = checked
    assert updated['creators'] == original['creators'] and updated['evidence'] == original['evidence']
    # Only publish after EVERY channel has passed validation. Errors leave the file untouched.
    TARGET.write_text(json.dumps(updated, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(f"Verified all {creator_count} creator entries across {channel_count} unique channels at {checked}")

if __name__ == '__main__':
    main()
