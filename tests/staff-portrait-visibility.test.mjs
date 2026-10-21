import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const policySource = await readFile(new URL("../app/staff-portrait-visibility.ts", import.meta.url), "utf8");
const policyJs = ts.transpileModule(policySource, {
  compilerOptions: { module: ts.ModuleKind.ESNext },
}).outputText;
const { canViewOriginalStaffPortraits } = await import(`data:text/javascript;base64,${Buffer.from(policyJs).toString("base64")}`);

test("only the VCK-ES90 login displays original portraits", async () => {
  assert.equal(canViewOriginalStaffPortraits("VCK-ES90"), true);
  assert.equal(canViewOriginalStaffPortraits(" vck-es90 "), true);
  for (const value of [undefined, "", "master", "VCK-ES90-other"]) {
    assert.equal(canViewOriginalStaffPortraits(value), false);
  }
  const access = JSON.parse(await readFile(new URL("../app/data/login-access.json", import.meta.url), "utf8"));
  for (const account of access.accounts) {
    assert.equal(canViewOriginalStaffPortraits(account.cdsid), account.cdsid.toUpperCase() === "VCK-ES90");
  }
});

test("both entrypoints use login identity, not the viewed showroom or master role", async () => {
  for (const file of ["../github-pages/main.tsx", "../app/dashboard/[cdsid]/analysis/page.tsx", "../app/dashboard/[cdsid]/dealer-analysis/page.tsx"]) {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    assert.match(source, /showOriginalPortraits=\{canViewOriginalStaffPortraits\(access\.loginCdsid\)\}/);
  }
});

test("YouTube portraits inherit the same opt-in policy without changing their frame", async () => {
  const dealer = await readFile(new URL("../app/DealerAnalysis.tsx", import.meta.url), "utf8");
  assert.match(dealer, /showOriginalPortraits = false/);
  assert.match(dealer, /<YouTubePerformance showOriginalPortraits=\{showOriginalPortraits\}/);
  const source = await readFile(new URL("../app/YouTubePerformance.tsx", import.meta.url), "utf8");
  assert.match(source, /showOriginalPortraits = false/);
  assert.match(source, /showOriginalPortraits && person.hasProfilePhoto/);
  assert.match(source, /showOriginalPhoto \? person.originalImage : person.image/);
  assert.match(source, /showOriginalPhoto \? <img className="yt-profile-original"/);
  assert.match(source, /className="yt-profile-solid-silhouette"/);
  assert.match(source, /className="yt-fallback-silhouette"/);
  const css = await readFile(new URL("../app/youtube-performance.css", import.meta.url), "utf8");
  assert.match(css, /img\.yt-profile-white-shirt,\s*\.youtube-performance\.yt-compact \.yt-row-person \.yt-row-avatar img\.yt-profile-original\{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;object-position:center top;transform:scale\(1\.35\);transform-origin:center top\}/);
});

test("portrait rendering defaults to silhouettes and leaves fallback images intact", async () => {
  const source = await readFile(new URL("../app/CompetitiveAnalysis.tsx", import.meta.url), "utf8");
  assert.match(source, /showOriginalPortraits = false/);
  assert.match(source, /showOriginalPortraits \? selectedStaffProfile\.image : selectedStaffProfile\.image\.replace/);
  assert.match(source, /showOriginalPortraits \? \([\s\S]*?className="staff-photo-original"/);
  assert.match(source, /className="staff-photo-solid-silhouette"/);
  assert.match(source, /: selectedStaffFallbackProfileImage/);
  assert.match(source, /disabled=\{!showOriginalPortraits \|\| !selectedStaffProfile\?\.smileImage\}/);
  assert.match(source, /showOriginalPortraits && selectedStaffProfile\.smileImage/);
});
