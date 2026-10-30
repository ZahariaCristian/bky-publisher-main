const numericOptions = (options = []) => [...new Set(
  (Array.isArray(options) ? options : [])
    .map((option) => `${option || ""}`.match(/\d+/)?.[0])
    .filter(Boolean)
    .map(Number)
    .filter(Number.isFinite)
)];

const resolveRemoteTopClimbs = (requestedClimbs, availableOptions = []) => {
  const requested = Number(requestedClimbs);
  const available = numericOptions(availableOptions);

  if (available.includes(requested)) {
    return { value: requested, adjusted: false, available };
  }
  // Bakecaincontrii replaced its legacy single-risalita Top with a minimum of
  // three risalite for the selected day range. Keep this migration deliberately
  // narrow so a future price/product change cannot silently select 10 risalite.
  if (requested === 1 && available.includes(3)) {
    return { value: 3, adjusted: true, available };
  }
  return { value: null, adjusted: false, available };
};

const inferTopTimeRange = (timeSlot = "") => {
  const normalized = `${timeSlot || ""}`.trim().toUpperCase();
  if (["MORNING", "AFTERNOON", "EVENING", "NIGHT"].includes(normalized)) return normalized;
  const startHour = Number(`${timeSlot || ""}`.match(/(?:^|\s)(\d{1,2}):\d{2}/)?.[1]);
  if (!Number.isFinite(startHour)) return "";
  if (startHour < 6) return "NIGHT";
  if (startHour < 12) return "MORNING";
  if (startHour < 18) return "AFTERNOON";
  return "EVENING";
};

const normalizeTopPromotionConfig = (promo = {}) => {
  const explicit = promo.top && typeof promo.top === "object" ? promo.top : {};
  const legacy = `${promo.visibility || ""}`.trim().toLowerCase().match(/^(\d+)x(\d+)$/);
  const timeSlot = `${explicit.timeSlot || promo.schedule || ""}`.trim();
  const timeRange = `${explicit.timeRange || inferTopTimeRange(timeSlot)}`.trim().toUpperCase();
  const days = Number(explicit.days || (legacy ? legacy[2] : 0));
  const climbs = Number(explicit.climbs || (legacy ? legacy[1] : 0));
  const fullRangeBundle = timeRange !== "NIGHT" && timeSlot === timeRange;
  return {
    timeRange,
    timeSlot,
    days,
    climbs,
    valid: ["MORNING", "AFTERNOON", "EVENING", "NIGHT"].includes(timeRange) &&
      (fullRangeBundle
        ? days === 1 && climbs === 9
        : [1, 3, 7].includes(days) && [1, 10].includes(climbs)) &&
      Boolean(timeSlot),
  };
};

module.exports = { resolveRemoteTopClimbs, normalizeTopPromotionConfig };
