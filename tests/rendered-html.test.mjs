import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(new URL(pathname, "http://localhost/"), {
      headers: { accept: "text/html", host: "localhost" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("redirects the removed login route to the sample dashboard", async () => {
  const response = await render();
  assert.ok([307, 308].includes(response.status));
  assert.match(response.headers.get("location") ?? "", /\/dashboard\/6KR6834$/);
});

test("server-renders the selected CDSID dashboard", async () => {
  const response = await render("/dashboard/6KR6834");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /DSC COMMAND/);
  assert.match(html, /전시장 전투력/);
  assert.match(html, /3대 핵심 지표/);
  assert.match(html, /평가 기준 한눈에 보기/);
  assert.match(html, /최근 업데이트/);
  assert.match(html, /V3S/);
  assert.match(html, /VOC/);
  assert.match(html, /CX Index/);
  assert.match(html, /전국 39개/);
  assert.match(html, /6KR6834/);
  for (let week = 1; week <= 52; week += 1) {
    assert.match(html, new RegExp(`W${String(week).padStart(2, "0")}`));
  }
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("ships project metadata and removes the disposable starter", async () => {
  const [page, dashboardPage, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/[cdsid]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /redirect\("\/dashboard\/6KR6834"\)/);
  assert.doesNotMatch(page, /LoginHome/);
  assert.match(dashboardPage, /import Dashboard/);
  assert.match(dashboardPage, /isEditorEmail/);
  assert.match(layout, /generateMetadata/);
  assert.match(layout, /볼보 관리자 전용/);
  assert.match(layout, /og\.png/);
  assert.match(layout, /lang="ko"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(
    access(new URL("../app/_sites-preview", templateRoot)),
  );
});

test("ships Volvo Centum for Latin text and Paperlogy 5 for Korean text", async () => {
  const css = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );

  assert.match(css, /font-family: "Volvo Centum Web"/);
  assert.match(css, /font-family: "Paperlogy 5"/);
  assert.match(css, /--font-ui:[\s\S]*var\(--font-volvo\)[\s\S]*var\(--font-korean\)/);
  assert.doesNotMatch(css, /Georgia|Helvetica|Pretendard|--font-sans/);

  await Promise.all([
    access(new URL("public/fonts/volvo-centum-light.ttf", templateRoot)),
    access(new URL("public/fonts/volvo-centum-regular.ttf", templateRoot)),
    access(new URL("public/fonts/volvo-centum-semibold.ttf", templateRoot)),
    access(new URL("public/fonts/volvo-centum-bold.ttf", templateRoot)),
    access(new URL("public/fonts/paperlogy-5-medium.ttf", templateRoot)),
  ]);
});
