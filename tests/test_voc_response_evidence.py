import runpy
import unittest
from pathlib import Path

update = runpy.run_path(str(Path(__file__).resolve().parents[1] / "scripts/sync-voc-response-evidence.py"))["update_snapshot"]


class ResponseEvidenceTest(unittest.TestCase):
    def test_first_snapshot_is_baseline(self):
        snapshot = update(None, {"2023": 500, "2026": 400}, "2026-10-14")
        self.assertEqual(snapshot["totalResponses"], 900)
        self.assertEqual(snapshot["previousTotalResponses"], 900)

    def test_next_changed_snapshot_compares_previous_collection(self):
        first = update(None, {"2026": 400}, "2026-10-14")
        second = update(first, {"2026": 440}, "2026-10-15")
        self.assertEqual(second["previousTotalResponses"], 400)
        self.assertEqual(update(second, {"2026": 440}, "2026-10-15"), second)
        third = update(second, {"2026": 420}, "2026-10-15")
        self.assertEqual(third["previousTotalResponses"], 440)

    def test_rejects_invalid_volume(self):
        with self.assertRaises(ValueError):
            update(None, {"2026": 0}, "2026-10-14")
