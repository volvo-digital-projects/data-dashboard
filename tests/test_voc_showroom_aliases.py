import json
import runpy
import tempfile
import unittest
from pathlib import Path

import openpyxl


SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
generator = runpy.run_path(str(SCRIPTS / "generate-voc-staff-analysis.py"))
refresh = runpy.run_path(str(SCRIPTS / "update-voc-2026-analysis.py"))
sent_sync = runpy.run_path(str(SCRIPTS / "sync-voc-sent-to-staff-analysis.py"))


class ShowroomAliasTest(unittest.TestCase):
    def test_only_verified_aliases_resolve_to_existing_names(self):
        for module in (generator, refresh, sent_sync):
            normalise = module["normalise_showroom_name"]
            for alias, canonical in (("대치", "강남대치"), ("신사", "강남신사"), ("분당서현", "분당")):
                self.assertEqual(normalise(alias), canonical)
                self.assertEqual(normalise("볼보 " + alias), canonical)
                self.assertEqual(normalise(canonical), canonical)
            self.assertEqual(normalise("분당판교"), "분당판교")
            self.assertEqual(normalise("미등록전시장"), "미등록전시장")

    def test_aliases_combine_responses_without_changing_history_or_codes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source, output = root / "source.xlsx", root / "consultation.json"
            workbook = openpyxl.Workbook()
            sheet = workbook.active
            sheet.title = "2026"
            sheet.append(["test source"])
            sheet.append(["방문 전시장", "상담 만족도", "전시장 방문일"])
            for name, score in (("대치", 9), ("신사", 8), ("분당", 7), ("분당서현", 10)):
                sheet.append([name, score, "2026-10-04"])
            workbook.save(source)
            baseline = [9.0, 3, 9.0, 1, 9.0, 1, 9.0, 1, None, 0]
            payload = {"years": [2023, 2024, 2025, 2026], "national": baseline[:],
                       "showrooms": {key: baseline[:] for key in ("daechi", "sinsa", "bundang")}}
            output.write_text(json.dumps(payload), encoding="utf-8")
            staff = {"source": {"sentThrough": "2026-10-04", "vocThrough": "2026-10-04"},
                     "showrooms": {key: {"showroom": name} for key, name in
                                   (("daechi", "강남대치"), ("sinsa", "강남신사"), ("bundang", "분당"))}}
            refresh["refresh_consultation"](source, output, staff)
            actual = json.loads(output.read_text(encoding="utf-8"))
            self.assertEqual(set(actual["showrooms"]), set(payload["showrooms"]))
            self.assertEqual(actual["national"][8:], [8.5, 4])
            self.assertEqual(actual["showrooms"]["bundang"][8:], [8.5, 2])
            for key, values in actual["showrooms"].items():
                self.assertEqual(values[2:8], payload["showrooms"][key][2:8])
            self.assertEqual(actual["responseRateResponses"]["national"][-1], 4)


if __name__ == "__main__":
    unittest.main()
