"""Official API only. Publish classifications/permalinks, never authors or raw text.
All channel thread pages and every reply page are visited. Any API error retains
the prior complete snapshot. API availability is not proof of inaccessible comments.
"""
import datetime
import json
import os
import re
import sys
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def classify(text, owner=False):
    text = unicodedata.normalize("NFKC", text)
    if owner:
        return "owner", "운영자 답글", "채널 운영자 답글로 의견 분석에서 분리했습니다."
    positive = bool(re.search(r"감사|(?<!불)친절|잘 ?봤|좋[네요습니다아요]|도움|최고|꼼꼼|유익|명확|멋[져지]|만족|추천|thank|great|excellent|helpful", text, re.I))
    negative = bool(re.search(r"불친절|불만|아쉽|부족|어렵|불편|시끄|안 ?들|잘못|틀[렸린]|개선|별로|최악|실망|짜증|싫[어요다]|bad|terrible|disappoint", text, re.I))
    if negative:
        # Words alone cannot establish complaint, target, negation or intent.
        # Never publish a negative verdict from keyword matches; the visible
        # negative summaries require a separate, evidence-backed text review.
        return "review", "문맥 검토 대기", "표현만으로 부정 여부를 확정하지 않습니다."
    if positive:
        topic = "친절·상담 응대" if re.search(r"친절|상담|응대|딜러", text) else "설명·정보 전달" if re.search(r"설명|정보|전문", text) else "영상·콘텐츠 반응"
        return "positive", topic, "관련 긍정 표현을 자동 탐지했습니다. 직원 능력 판정은 아닙니다."
    return "other", "중립·기타", "긍정·개선 방향을 단정할 수 없는 질문 또는 기타 의견입니다."

def owner_phone_promotion(text, owner):
    if not owner:
        return False
    text = unicodedata.normalize("NFKC", text)
    return bool(re.search(r"(?<!\d)(?:\+?82[\s().-]*0?|0)(?:1[016789]|2|[3-6]\d|70)[\s().-]*\d{3,4}[\s().-]*\d{4}(?!\d)", text))

class Api:
    def __init__(self, key):
        self.key = key
        self.calls = 0

    def __call__(self, endpoint, **params):
        self.calls += 1
        # Six regular runs plus one retry each stay under 9,000 requests/day.
        if self.calls > 750:
            raise RuntimeError("API request budget reached; previous snapshot retained")
        url = "https://www.googleapis.com/youtube/v3/" + endpoint + "?" + urllib.parse.urlencode({**params, "key": self.key})
        try:
            with urllib.request.urlopen(url, timeout=45) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            # Never print the URL, response body, or credentials.
            reason = "unknown"
            try:
                candidate = json.load(error).get("error", {}).get("errors", [{}])[0].get("reason")
                if candidate in {"accessNotConfigured", "quotaExceeded", "dailyLimitExceeded", "keyInvalid", "forbidden", "commentsDisabled", "channelNotFound"}:
                    reason = candidate
            except Exception:
                pass
            raise RuntimeError(f"YouTube API HTTP {error.code} ({reason}); previous snapshot retained") from None
        except Exception:
            raise RuntimeError("YouTube API connection failed; previous snapshot retained") from None

def pages(api, endpoint, **params):
    seen = set()
    while True:
        response = api(endpoint, **params)
        if "items" not in response or not isinstance(response["items"], list):
            raise RuntimeError("Invalid API response")
        yield from response["items"]
        token = response.get("nextPageToken")
        if not token:
            return
        if token in seen:
            raise RuntimeError("Repeated API page token")
        seen.add(token)
        params["pageToken"] = token

def collect_channel(api, channel_id, allowed_video_ids=None, review_texts=None):
    found = {}
    coverage = {}
    excluded = set()
    def add(comment, video_id):
        snippet = comment["snippet"]
        cid = comment["id"]
        text = snippet.get("textOriginal", snippet.get("textDisplay", ""))
        owner = snippet.get("authorChannelId", {}).get("value") == channel_id
        if owner_phone_promotion(text, owner):
            excluded.add(cid)
            return
        category, topic, summary = classify(text, owner)
        if review_texts is not None and not owner:
            clean = re.sub(r"(?<!\d)(?:\+?82[\s().-]*0?|0)(?:1[016789]|2|[3-6]\d|70)[\s().-]*\d{3,4}[\s().-]*\d{4}(?!\d)", "[연락처 제외]", unicodedata.normalize("NFKC", text))
            clean = re.sub(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", "[이메일 제외]", clean)
            review_texts[cid] = clean
        found[cid] = dict(id=cid, category=category, topic=topic, summary=summary,
                         videoId=video_id, kind="video",
                         url=f"https://www.youtube.com/watch?v={video_id}&lc={cid}")

    # Channel-wide listing includes long-form, Shorts and public livestream videos;
    # it does not limit the scan to recent or popular uploads.
    for thread in pages(api, "commentThreads", part="snippet,replies", allThreadsRelatedToChannelId=channel_id,
                        maxResults=100, order="time", textFormat="plainText"):
        snippet = thread["snippet"]
        video_id = snippet.get("videoId")
        if not video_id:  # Exclude legacy channel discussion, which is not a video.
            continue
        if allowed_video_ids is not None and video_id not in allowed_video_ids:
            continue
        top = snippet["topLevelComment"]
        add(top, video_id)
        replies = {item["id"]: item for item in thread.get("replies", {}).get("comments", [])}
        expected = snippet.get("totalReplyCount", 0)
        if len(replies) < expected:
            replies = {item["id"]: item for item in pages(api, "comments", part="snippet",
                       parentId=top["id"], maxResults=100, textFormat="plainText")}
        if len(replies) < expected:
            raise RuntimeError("Reply count changed or incomplete; previous snapshot retained")
        for reply in replies.values():
            add(reply, video_id)
        coverage[video_id] = dict(id=video_id, kind="video", status="complete", reported=None)
    counts = Counter(entry["category"] for entry in found.values())
    return dict(total=len(found), videos=len(coverage), completeVideos=len(coverage), partialVideos=0,
                unavailableVideos=0, counts={key:counts[key] for key in ("positive","suggestion","other","review","owner")},
                entries=list(found.values()), coverage=list(coverage.values()), status="complete",
                excludedOwnerPromotions=len(excluded))

def refresh(key, source, destination):
    if not key:
        raise RuntimeError("YOUTUBE_API_KEY is not configured; previous snapshot retained")
    api = Api(key)
    channels = {}
    review = {}
    for channel in source["channels"]:
        allowed = set(channel.get("scopeVideoIds", [])) if channel.get("videoBrandFilter") else None
        texts = {} if os.environ.get("COMMENT_REVIEW_OUTPUT") else None
        channels[channel["id"]] = collect_channel(api, channel["id"], allowed, texts)
        if texts is not None:
            review[channel["id"]] = list(texts.values())
    output = dict(checkedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                  method="YouTube Data API v3 · 채널 전체 공개 댓글·답글 순회 · 운영자 전화번호 홍보 제외 · 부정 표현은 문맥 검토 대기",
                  channels=channels, apiCalls=api.calls)
    # Write only after every channel succeeds, then replace atomically.
    temporary = destination.with_suffix(".tmp")
    temporary.write_text(json.dumps(output, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    temporary.replace(destination)
    if os.environ.get("COMMENT_REVIEW_OUTPUT"):
        Path(os.environ["COMMENT_REVIEW_OUTPUT"]).write_text(json.dumps(dict(checkedAt=output["checkedAt"], channels=review), ensure_ascii=False), encoding="utf-8")

def main():
    source = json.loads((ROOT / "app/data/youtube-creators.json").read_text(encoding="utf-8"))
    refresh(os.environ.get("YOUTUBE_API_KEY"), source, ROOT / "app/data/youtube-comments.json")

if __name__ == "__main__":
    try:
        main()
    except RuntimeError as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
