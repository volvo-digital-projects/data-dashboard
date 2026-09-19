"""Hourly public metrics refresh. All-or-nothing; reviewed evidence is immutable here."""
import concurrent.futures
import copy
import datetime
import json
from pathlib import Path
import runpy

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "app/data/youtube-creators.json"

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

def main():
    original = json.loads(TARGET.read_text(encoding='utf-8'))
    collect = runpy.run_path(str(ROOT / 'scripts/collect-youtube-channels.py'))['collect']
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda channel: collect(channel['url']), original['channels']))
    updated = copy.deepcopy(original)
    updated['channels'] = [merge_channel(old, fresh, sum(p['channelId']==old['id'] for p in original['creators'])>1)
                           for old, fresh in zip(original['channels'], results)]
    checked = datetime.datetime.now(datetime.timezone.utc).isoformat()
    for channel in updated['channels']:
        channel['checkedAt'] = checked
    assert updated['creators'] == original['creators'] and updated['evidence'] == original['evidence']
    # Only publish after EVERY channel has passed validation. Errors leave the file untouched.
    TARGET.write_text(json.dumps(updated, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(f"Verified {len(updated['channels'])} unique channels for {len(updated['creators'])} creators at {checked}")

if __name__ == '__main__':
    main()
