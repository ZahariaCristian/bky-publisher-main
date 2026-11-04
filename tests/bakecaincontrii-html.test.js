const test = require("node:test");
const assert = require("node:assert/strict");
const { extractParamsFromHtml } = require("../adsManage/bakecaincontrii/common");
const {
  firstPostHeader,
  secondPostHeader,
  thirdPostHeader,
} = require("../adsManage/bakecaincontrii/dataComposer");

test("extracts Bakecaincontrii form parameters without Cheerio", () => {
  const html = `
    <html><head><meta content="https://bari.bakecaincontrii.com/u/post-promote/code/?a=1&amp;b=2" property="og:url"></head>
    <body>
      <input value="csrf-value" type="hidden" name="csrfmiddlewaretoken">
      <input name="private_code" value="private-value">
    </body></html>`;
  assert.deepEqual(extractParamsFromHtml(html, ["private_code", "csrfmiddlewaretoken"]), {
    values: ["private-value", "csrf-value"],
    ogUrl: "https://bari.bakecaincontrii.com/u/post-promote/code/?a=1&b=2",
  });
});

test("falls back to post-promote-manager attributes", () => {
  const html = '<post-promote-manager private-code="remote-code" csrf-token="remote-csrf"></post-promote-manager>';
  assert.deepEqual(extractParamsFromHtml(html, ["private_code", "csrfmiddlewaretoken"]), {
    values: ["remote-code", "remote-csrf"],
    ogUrl: undefined,
  });
});

test("uses the active Bakecaincontrii origin in workflow headers", () => {
  const origin = "https://milano.bakecaincontrii.com";
  assert.equal(firstPostHeader("cookie", origin).authority, "milano.bakecaincontrii.com");
  assert.equal(secondPostHeader("cookie", origin, "temporary").origin, origin);
  assert.equal(
    thirdPostHeader("cookie", origin, "temporary").referer,
    `${origin}/u/post-insert-images/temporary/`
  );
});
