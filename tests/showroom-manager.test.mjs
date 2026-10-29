import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../app/showroom-manager.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { showroomManagerName } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
const gwangan = { cdsid: "6KR6850", manager: "김호영" };
const gimhae = { cdsid: "6KR6863", manager: "김희종" };

test("retains current managers until the Seoul appointment date", () => {
  const before = Date.parse("2026-10-31T23:59:59+09:00");
  assert.equal(showroomManagerName(gwangan, before), "김호영");
  assert.equal(showroomManagerName(gimhae, before), "김희종");
});

test("applies both appointments exactly at November 1 Seoul midnight", () => {
  const effective = Date.parse("2026-10-31T15:00:00Z");
  assert.equal(showroomManagerName(gwangan, effective), "양지승");
  assert.equal(showroomManagerName(gimhae, effective), "김호영");
  assert.equal(showroomManagerName({ cdsid: "6KR6841", manager: "기존 지점장" }, effective), "기존 지점장");
  assert.equal(gwangan.manager, "김호영"); // Preserve historical source data.
});

test("all displayed manager names and selection labels use appointment policy", async () => {
  for (const file of ["../app/Dashboard.tsx", "../app/CompetitiveAnalysis.tsx"]) {
    const component = await readFile(new URL(file, import.meta.url), "utf8");
    assert.match(component, /showroomManagerName\(selected\)/);
    assert.doesNotMatch(component, /\{selected\.manager\}|\{item\.manager\}/);
  }
});
