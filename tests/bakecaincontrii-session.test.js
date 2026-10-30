const test = require("node:test");
const assert = require("node:assert/strict");
const {
  assertBakecaincontriiSession,
} = require("../adsManage/bakecaincontrii/session");

const validCookies = {
  csrftoken: "csrf-token",
  logged_cookie: '"publisher@example.com",session-data',
  f_session_id: "session-id",
};

test("accepts a complete Bakecaincontrii session for the expected account", () => {
  assert.deepEqual(
    assertBakecaincontriiSession(validCookies, "publisher@example.com"),
    { cookieEmail: "publisher@example.com" }
  );
});

test("rejects an incomplete Bakecaincontrii session before a remote operation", () => {
  assert.throws(
    () => assertBakecaincontriiSession({ ...validCookies, csrftoken: "" }),
    (error) => {
      assert.equal(error.code, "BAKECAINCONTRII_COOKIES_INCOMPLETE");
      assert.equal(error.stage, "session");
      assert.deepEqual(error.details.missing, ["csrftoken"]);
      return true;
    }
  );
});

test("rejects cookies belonging to another Bakecaincontrii account", () => {
  assert.throws(
    () => assertBakecaincontriiSession(validCookies, "other@example.com"),
    (error) => {
      assert.equal(error.code, "BAKECAINCONTRII_COOKIE_USER_MISMATCH");
      assert.equal(error.stage, "session");
      assert.equal(error.details.cookieEmail, "publisher@example.com");
      return true;
    }
  );
});
