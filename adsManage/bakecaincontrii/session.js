const { extractEmail } = require("./common");

const sessionError = (code, message, details = {}) => {
  const error = new Error(message);
  error.code = code;
  error.stage = "session";
  error.details = details;
  return error;
};

const assertBakecaincontriiSession = (cookies, expectedEmail = "") => {
  if (!cookies || typeof cookies !== "object") {
    throw sessionError("BAKECAINCONTRII_COOKIES_MISSING", "Cookie Bakecaincontrii non disponibili.");
  }
  const missing = ["csrftoken", "logged_cookie", "f_session_id"]
    .filter((name) => !`${cookies[name] || ""}`.trim());
  if (missing.length) {
    throw sessionError(
      "BAKECAINCONTRII_COOKIES_INCOMPLETE",
      `Cookie Bakecaincontrii mancanti: ${missing.join(", ")}.`,
      { missing }
    );
  }

  const cookieEmail = extractEmail(cookies.logged_cookie || "");
  if (expectedEmail && cookieEmail && cookieEmail.toLowerCase() !== `${expectedEmail}`.toLowerCase()) {
    throw sessionError(
      "BAKECAINCONTRII_COOKIE_USER_MISMATCH",
      `La sessione Bakecaincontrii appartiene a ${cookieEmail}, non a ${expectedEmail}.`,
      { expectedEmail, cookieEmail }
    );
  }
  return { cookieEmail };
};

module.exports = { assertBakecaincontriiSession };
