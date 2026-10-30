const withScope = (level, values) => {
  const method = level === "debug" || level === "success" ? "log" : level;
  console[method](`[bakecaincontrii:${level}]`, ...values);
};

module.exports = {
  debug: (...values) => withScope("debug", values),
  success: (...values) => withScope("success", values),
  warn: (...values) => withScope("warn", values),
  error: (...values) => withScope("error", values),
};
