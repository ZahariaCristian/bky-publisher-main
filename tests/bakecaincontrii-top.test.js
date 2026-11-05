const test = require("node:test");
const assert = require("node:assert/strict");
const {
  resolveRemoteTopClimbs,
  resolveRemoteTopTimeSlot,
  normalizeTopPromotionConfig,
} = require("../lib/bakecaincontriiTop");

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

test("accepts automatic climbs for the current Top workflow", () => {
  assert.deepEqual(normalizeTopPromotionConfig({
    top: { timeRange: "MORNING", timeSlot: "MORNING", days: 1, climbs: null },
  }), {
    timeRange: "MORNING",
    timeSlot: "MORNING",
    days: 1,
    climbs: null,
    valid: true,
  });
  assert.equal(normalizeTopPromotionConfig({
    top: { timeRange: "EVENING", timeSlot: "EVENING", days: 3, climbs: 9 },
  }).valid, false);
  assert.equal(normalizeTopPromotionConfig({
    top: { timeRange: "AFTERNOON", timeSlot: "14:00 - 15:00", days: 3, climbs: null },
  }).valid, true);
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

test("keeps an exact remotely available Top time slot", () => {
  assert.deepEqual(resolveRemoteTopTimeSlot("MORNING", "07:00 - 08:00", [
    { value: "06:00 - 07:00", text: "06:00 - 07:00" },
    { value: "07:00 - 08:00", text: "07:00 - 08:00" },
  ]), {
    value: "07:00 - 08:00",
    text: "07:00 - 08:00",
    adjusted: false,
    reason: null,
    options: [
      { value: "06:00 - 07:00", text: "06:00 - 07:00" },
      { value: "07:00 - 08:00", text: "07:00 - 08:00" },
    ],
  });
});

test("uses the first offered hour when a requested full-range bundle is unavailable", () => {
  const resolved = resolveRemoteTopTimeSlot("MORNING", "MORNING", [
    { value: "", text: "Seleziona fascia oraria" },
    { value: "06:00 - 07:00", text: "06:00 - 07:00" },
    { value: "07:00 - 08:00", text: "07:00 - 08:00" },
  ]);
  assert.equal(resolved.value, "06:00 - 07:00");
  assert.equal(resolved.adjusted, true);
  assert.equal(resolved.reason, "full-range-unavailable");
});

test("does not replace a missing hourly Top selection with another hour", () => {
  const resolved = resolveRemoteTopTimeSlot("MORNING", "08:00 - 09:00", [
    { value: "06:00 - 07:00", text: "06:00 - 07:00" },
  ]);
  assert.equal(resolved.value, null);
  assert.equal(resolved.adjusted, false);
});
