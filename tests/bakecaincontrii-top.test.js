const test = require("node:test");
const assert = require("node:assert/strict");
const { resolveRemoteTopClimbs, normalizeTopPromotionConfig } = require("../lib/bakecaincontriiTop");

test("normalizes the current versioned Top configurator payload", () => {
  assert.deepEqual(normalizeTopPromotionConfig({
    visibility: "10x3",
    schedule: "legacy value",
    top: {
      timeRange: "AFTERNOON",
      timeSlot: "14:00 - 15:00",
      days: 3,
      climbs: 10,
    },
  }), {
    timeRange: "AFTERNOON",
    timeSlot: "14:00 - 15:00",
    days: 3,
    climbs: 10,
    valid: true,
  });
});

test("keeps legacy Top schedules publishable during migration", () => {
  assert.deepEqual(normalizeTopPromotionConfig({ visibility: "1x7", schedule: "23:00 - 00:00" }), {
    timeRange: "EVENING",
    timeSlot: "23:00 - 00:00",
    days: 7,
    climbs: 1,
    valid: true,
  });
});

test("accepts the six-hour whole-period bundle only as one day and nine climbs", () => {
  assert.deepEqual(normalizeTopPromotionConfig({
    top: { timeRange: "MORNING", timeSlot: "MORNING", days: 1, climbs: 9 },
  }), {
    timeRange: "MORNING",
    timeSlot: "MORNING",
    days: 1,
    climbs: 9,
    valid: true,
  });
  assert.equal(normalizeTopPromotionConfig({
    top: { timeRange: "EVENING", timeSlot: "EVENING", days: 3, climbs: 9 },
  }).valid, false);
  assert.equal(normalizeTopPromotionConfig({
    top: { timeRange: "AFTERNOON", timeSlot: "AFTERNOON", days: 1, climbs: 10 },
  }).valid, false);
});

test("keeps an exact Top risalite option", () => {
  assert.deepEqual(resolveRemoteTopClimbs(10, ["3", "10"]), {
    value: 10,
    adjusted: false,
    available: [3, 10],
  });
});

test("maps legacy one-risalita Top only to the current remote minimum of three", () => {
  assert.deepEqual(resolveRemoteTopClimbs(1, ["3"]), {
    value: 3,
    adjusted: true,
    available: [3],
  });
});

test("does not silently select an unrelated or expensive Top option", () => {
  assert.deepEqual(resolveRemoteTopClimbs(1, ["10"]), {
    value: null,
    adjusted: false,
    available: [10],
  });
  assert.deepEqual(resolveRemoteTopClimbs(10, ["3"]), {
    value: null,
    adjusted: false,
    available: [3],
  });
});
