import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("comments", Path(__file__).resolve().parents[1] / "scripts/refresh-youtube-comments.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

def comment(cid, text="설명 감사합니다", owner="viewer"):
    return {"id":cid, "snippet":{"textDisplay":text, "authorChannelId":{"value":owner}}}

class CommentsTest(unittest.TestCase):
    def test_all_thread_and_reply_pages_without_raw_text(self):
        calls = []
        def api(endpoint, **params):
            calls.append((endpoint, params))
            if endpoint == "commentThreads":
                if params.get("pageToken") == "next":
                    return {"items":[{"snippet":{"videoId":"short", "topLevelComment":comment("t2"), "totalReplyCount":0}}]}
                return {"items":[{"snippet":{"videoId":"long", "topLevelComment":comment("t1"), "totalReplyCount":2},
                                  "replies":{"comments":[comment("r1")]}}], "nextPageToken":"next"}
            if params.get("pageToken") == "reply-next":
                return {"items":[comment("r2", owner="channel")]}
            return {"items":[comment("r1")], "nextPageToken":"reply-next"}
        result = module.collect_channel(api, "channel")
        self.assertEqual(result["total"], 4)
        self.assertEqual(result["videos"], 2)
        self.assertEqual(sum(result["counts"].values()), 4)
        self.assertEqual(result["counts"]["owner"], 1)
        self.assertEqual(len(calls), 4)
        self.assertNotIn("textDisplay", json.dumps(result))
        self.assertNotIn("authorChannelId", json.dumps(result))
        self.assertNotIn("설명 감사합니다", json.dumps(result, ensure_ascii=False))

    def test_reply_gap_fails_closed(self):
        def api(endpoint, **params):
            if endpoint == "comments": return {"items":[]}
            return {"items":[{"snippet":{"videoId":"v", "topLevelComment":comment("t"), "totalReplyCount":2}}]}
        with self.assertRaises(RuntimeError):
            module.collect_channel(api, "channel")

    def test_mixed_brand_channel_comments_only_count_scoped_videos(self):
        def api(endpoint, **params):
            return {"items":[
                {"snippet":{"videoId":"volvo", "topLevelComment":comment("v"), "totalReplyCount":0}},
                {"snippet":{"videoId":"mini", "topLevelComment":comment("m"), "totalReplyCount":0}},
            ]}
        result = module.collect_channel(api, "channel", {"volvo"})
        self.assertEqual(result["total"], 1)
        self.assertEqual(result["videos"], 1)
        self.assertEqual(result["coverage"][0]["id"], "volvo")

    def test_missing_key_preserves_snapshot(self):
        with tempfile.TemporaryDirectory() as directory:
            destination = Path(directory) / "snapshot.json"
            destination.write_text("previous", encoding="utf-8")
            with self.assertRaises(RuntimeError):
                module.refresh("", {"channels":[]}, destination)
            self.assertEqual(destination.read_text(), "previous")

    def test_repeated_page_token_rejected(self):
        with self.assertRaises(RuntimeError):
            list(module.pages(lambda *args, **kwargs: {"items":[], "nextPageToken":"same"}, "comments"))

    def test_zero_is_valid_only_after_successful_scan(self):
        result = module.collect_channel(lambda *args, **kwargs: {"items":[]}, "channel")
        self.assertEqual(result["status"], "complete")
        self.assertEqual(result["total"], 0)

    def test_conservative_classification(self):
        self.assertEqual(module.classify("상담 불친절")[0], "review")
        self.assertEqual(module.classify("영상 감사합니다 하지만 아쉽네요")[0], "review")
        self.assertEqual(module.classify("안녕하세요")[0], "other")

    def test_general_reactions_and_mixed_opinions(self):
        self.assertEqual(module.classify("정말 최고입니다")[0], "positive")
        self.assertEqual(module.classify("최악입니다 실망했어요")[0], "review")
        self.assertEqual(module.classify("정보 감사합니다 하지만 불편해요")[0], "review")

    def test_keyword_matches_never_decide_negative_sentiment(self):
        for text in [
            "배경음이 시끄러운가요?",
            "이 기능은 불편하지 않나요?",
            "틀린 내용은 없고 좋습니다",
            "차량 수리비가 불만입니다",
            "무이자 한도가 얼마인가요?",
            "골프백 시연을 보여주세요",
            "설명이 부족해서 실망했습니다",
        ]:
            with self.subTest(text=text):
                self.assertNotIn(module.classify(text)[0], {"suggestion", "negative"})

    def test_excludes_owner_phone_promotion_but_keeps_viewer_and_replies(self):
        def api(endpoint, **params):
            return {"items":[{"snippet":{"videoId":"v", "topLevelComment":comment("promo", "상담 010-1234-5678", "channel"), "totalReplyCount":2},
                              "replies":{"comments":[comment("viewer", "설명 감사합니다 010-1111-2222"), comment("owner", "감사합니다", "channel")]}}]}
        result = module.collect_channel(api, "channel")
        self.assertEqual(result["total"], 2)
        self.assertEqual(result["excludedOwnerPromotions"], 1)
        self.assertEqual(result["counts"]["positive"], 1)
        self.assertEqual(result["counts"]["owner"], 1)
        self.assertNotIn("promo", [entry["id"] for entry in result["entries"]])
        self.assertNotIn("010-", json.dumps(result))
        for phone in ["01012345678", "+82 10 1234 5678", "０１０－１２３４－５６７８", "02-123-4567"]:
            self.assertTrue(module.owner_phone_promotion(phone, True))
            self.assertFalse(module.owner_phone_promotion(phone, False))
