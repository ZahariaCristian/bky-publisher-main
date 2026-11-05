const ROME_TIME_ZONE = "Europe/Rome";

const romePartsFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: ROME_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
});

function getRomeParts(value) {
    const parts = romePartsFormatter.formatToParts(value);
    const result = {};
    for (const part of parts) {
        if (part.type !== "literal") result[part.type] = Number.parseInt(part.value, 10);
    }
    return result;
}

function getStoredWallClockParts(value) {
    if (typeof value === "string") {
        const match = value.trim().match(
            /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?/
        );
        if (match) {
            return {
                year: Number.parseInt(match[1], 10),
                month: Number.parseInt(match[2], 10),
                day: Number.parseInt(match[3], 10),
                hour: Number.parseInt(match[4], 10),
                minute: Number.parseInt(match[5], 10),
                second: Number.parseInt(match[6] || "0", 10),
                millisecond: Number.parseInt(`${match[7] || "0"}`.padEnd(3, "0"), 10)
            };
        }
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return {
        year: date.getUTCFullYear(),
        month: date.getUTCMonth() + 1,
        day: date.getUTCDate(),
        hour: date.getUTCHours(),
        minute: date.getUTCMinutes(),
        second: date.getUTCSeconds(),
        millisecond: date.getUTCMilliseconds()
    };
}

function partsAsUtcMilliseconds(parts) {
    return Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hour,
        parts.minute,
        parts.second,
        parts.millisecond || 0
    );
}

function sameWallClock(left, right) {
    return left.year === right.year
        && left.month === right.month
        && left.day === right.day
        && left.hour === right.hour
        && left.minute === right.minute
        && left.second === right.second;
}

/**
 * tblSchedulazioni.data stores an Italian wall-clock value in an ISO-shaped
 * database field. Convert those components to the real UTC instant before
 * comparing a schedule with the current time.
 */
function fromRomeWallClockStorage(value) {
    const wanted = getStoredWallClockParts(value);
    if (!wanted) return new Date(NaN);

    const wantedAsUtc = partsAsUtcMilliseconds(wanted);
    let candidate = wantedAsUtc;

    // Resolve the Europe/Rome offset at the requested date. Repeating also
    // handles the offset transition close to DST boundaries.
    for (let attempt = 0; attempt < 4; attempt += 1) {
        const observed = getRomeParts(new Date(candidate));
        const observedAsUtc = partsAsUtcMilliseconds(observed);
        const adjustment = wantedAsUtc - observedAsUtc;
        candidate += adjustment;
        if (adjustment === 0) break;
    }

    const resolved = new Date(candidate);
    if (!sameWallClock(getRomeParts(resolved), wanted)) {
        // This normally means the requested local time is inside the missing
        // hour created by the spring DST transition.
        return new Date(NaN);
    }
    return resolved;
}

/**
 * Convert a real instant to the wall-clock-shaped Date used by existing
 * tblSchedulazioni range queries.
 */
function toRomeWallClockStorage(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return new Date(NaN);
    const parts = getRomeParts(date);
    return new Date(Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hour,
        parts.minute,
        parts.second,
        date.getUTCMilliseconds()
    ));
}

function formatRomeWallClockTime(value) {
    const parts = getStoredWallClockParts(value);
    if (!parts) return "";
    return `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

module.exports = {
    ROME_TIME_ZONE,
    fromRomeWallClockStorage,
    toRomeWallClockStorage,
    formatRomeWallClockTime
};
