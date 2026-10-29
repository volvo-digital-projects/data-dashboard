import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../app/showroom-manager.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { showroomManagerName } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
const gwangan = { cdsid: "6KR6850", manager: "김호영" };
const gimhae = { cdsid: "6KR6863", manager: "김희종" };

test("displays the requested managers immediately without a date gate", () => {
  assert.equal(showroomManagerName(gwangan), "양지승");
  assert.equal(showroomManagerName(gimhae), "김호영");
  assert.doesNotMatch(source, /Date\.now|Date\.parse/);
});

test("preserves other showrooms and historical source names", () => {
  assert.equal(showroomManagerName({ cdsid: "6KR6841", manager: "기존 지점장" }), "기존 지점장");
  assert.equal(gwangan.manager, "김호영"); // Preserve historical source data.
});

test("all displayed manager names and selection labels use appointment policy", async () => {
  for (const file of ["../app/Dashboard.tsx", "../app/CompetitiveAnalysis.tsx"]) {
    const component = await readFile(new URL(file, import.meta.url), "utf8");
    assert.match(component, /showroomManagerName\(selected\)/);
    assert.doesNotMatch(component, /\{selected\.manager\}|\{item\.manager\}/);
  }
});
