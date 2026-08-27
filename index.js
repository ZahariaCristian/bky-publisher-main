const dotenv = require('dotenv');
const fs = require("fs");
const http = require("http");
const { dirname } = require('path');
const appDir = dirname(require.main.filename);
// const { EOF } = require("dns");
// const { where } = require("sequelize");

const logger = require("./lib/logger");
const ctx = require("./ctx/model");
const { decryptPassword, wait, sleep, closeBotBrowser, isTurnstileUnsolvableError, updateOperation } = require("./utils");

const BakecaincontriiBot = require("./bots/bakecaincontrii");
const BakecaBot = require("./bots/bakeca");
const MeBot = require("./bots/megaescort");
const TrovagnoccaBot = require("./bots/trovagnocca");
const IncontriamociBot = require("./bots/incontriamoci");
const AmasensBot = require("./bots/amasens");
const MoscarossaBot = require("./bots/moscarossa");
const { getApiKey } = require("./adsManage/megaescort/client");
const { raw } = require('mysql');
const { platform } = require('os');

const Op = ctx.model.Sequelize.Op;

dotenv.config();
process.env.TZ = process.env.TIMEZONE;

var GLOBAL_PATH = "";
if (process.env.PROD == 1) {
    GLOBAL_PATH = process.env.APP_PATH_PRODUCTION;
} else {
    GLOBAL_PATH = appDir.replace("\\publisher", "");
}

const { cities } = JSON.parse(fs.readFileSync("./bots/settings/scrapingInfo.json"));
var botCheckPhone = null;
let checkPhoneMailLoop = null;
let phoneCheckRunning = false;
let phoneCheckSchedulerGeneration = 0;
let phoneCheckRestarting = false;
var groups = [];
var dateGlobal_string = new Date();
var published = new Array;
var crashedBot = new Array;
const sessionCache = new Map();
const sessionInflight = new Map();
const temporarilyDisabledUsers = new Set();
const rawLoginConcurrency = Number.parseInt(process.env.BAKECA_LOGIN_CONCURRENCY || process.env.LOGIN_CONCURRENCY || "4", 10);
const MAX_CONCURRENT_LOGINS = Number.isFinite(rawLoginConcurrency) && rawLoginConcurrency > 0 ? rawLoginConcurrency : 4;
let activeLoginCount = 0;
const loginWaitQueue = [];
const rawPublisherApiPort = Number.parseInt(process.env.PUBLISHER_API_PORT || "9998", 10);
const PUBLISHER_API_PORT = Number.isFinite(rawPublisherApiPort) && rawPublisherApiPort > 0 ? rawPublisherApiPort : 9998;
const PUBLISHER_API_HOST = `${process.env.PUBLISHER_API_HOST || "127.0.0.1"}`.trim() || "127.0.0.1";
const PUBLISH_IMAGE_LIMITS = Object.freeze({ amasens: 9, incontriamoci: 9, trovagnocca: 6, moscarossa: 20 });
const getPublishImageLimit = (platformName) => PUBLISH_IMAGE_LIMITS[platformName] || 5;
let publisherApiServer = null;

const getLastNumber = (str) => {
    const parts = str.split("x");
    return parseInt(parts[1], 10);
}

const getSessionKey = (bot, email) => `${bot?.platform || "unknown"}:${`${email || ""}`.trim().toLowerCase()}`;

function runLimitedLogin(task) {
    return new Promise((resolve, reject) => {
        const execute = () => {
            activeLoginCount += 1;
            Promise.resolve()
                .then(task)
                .then(resolve, reject)
                .finally(() => {
                    activeLoginCount -= 1;
                    const next = loginWaitQueue.shift();
                    if (next) next();
                });
        };

        if (activeLoginCount < MAX_CONCURRENT_LOGINS) {
            execute();
        } else {
            loginWaitQueue.push(execute);
        }
    });
}

async function ensureSession(bot, email) {
    // console.log(bot.email, bot.password, 'ensureSession1')
    if (!bot || !email) return bot?.login?.();
    const sessionKey = getSessionKey(bot, email);
    const cached = sessionCache.get(sessionKey);
    // console.log(cached, "platform cached")
    if (cached) {//If Cookies has
        const ok = await bot.initWithCookies?.(cached);
        if (ok) return cached;
        sessionCache.delete(sessionKey);
    }

    // console.log(bot.email, bot.password, sessionInflight, 'ensureSession2');
    if (sessionInflight.has(sessionKey)) {//If Login finished
        const cookies = await sessionInflight.get(sessionKey);
        const ok = await bot.initWithCookies?.(cookies);
        if (ok) return cookies;
        sessionCache.delete(sessionKey);
    }
    // console.log(bot.email, bot.password, 'ensureSession3')
    const loginPromise = (async () => {
        let unsolvableAttempt = 0;
        while (true) {
            try {
                const cookies = await runLimitedLogin(() => bot.login());
                if (cookies) sessionCache.set(sessionKey, cookies);
                if (temporarilyDisabledUsers.has(email)) {
                    temporarilyDisabledUsers.delete(email);
                    logger.Write(`Publisher INFO: utente ${email} riabilitato dopo login riuscito.`);
                }
                return cookies;
            } catch (err) {
                if (!isTurnstileUnsolvableError(err)) {
                    throw err;
                }

                unsolvableAttempt += 1;
                temporarilyDisabledUsers.add(email);

                const delayMs = Math.min(60000, 5000 + (unsolvableAttempt * 5000));
                const waitSeconds = Math.round(delayMs / 1000);

                logger.Write(`Publisher WARNING: Turnstile non risolto per ${email}. Utente disabilitato temporaneamente, nuovo login tra ${waitSeconds}s (tentativo ${unsolvableAttempt}).`);
                console.warn(`[!] Turnstile unsolvable for ${email}. Retry login in ${waitSeconds}s (attempt ${unsolvableAttempt}).`);

                await closeBotBrowser(bot, `${email} unsolvable captcha`);
                await wait(delayMs);
            }
        }
    })().finally(() => {
        sessionInflight.delete(sessionKey);
    });

    // console.log(bot.email, bot.password, 'ensureSession4')
    sessionInflight.set(sessionKey, loginPromise);
    return await loginPromise;
}

function isIncontriamociAuthenticationFailure(error, bot) {
    const message = `${error?.message || error || ""}`.toLowerCase();
    const currentUrl = `${bot?.page?.url?.() || ""}`.toLowerCase();
    return /\/user\/login|\/auth\/login/.test(currentUrl) ||
        /redirected? to login|session.*expired|cookies?.*(?:missing|expired)|login required|authentication required/.test(message) ||
        (/publish form not found|update form not found/.test(message) && /\/user\/login|\/auth\/login/.test(message));
}

async function runWithIncontriamociSessionRecovery(platform, operationName, operation) {
    if (platform?.platform !== "incontriamoci") {
        return operation();
    }

    try {
        return await operation();
    } catch (error) {
        if (!isIncontriamociAuthenticationFailure(error, platform.bot)) {
            throw error;
        }

        const username = platform.username || platform.bot?.email;
        logger.Write(`Publisher WARNING: Incontriamoci session expired for ${username}. Re-login before retrying ${operationName}.`);
        console.warn(`[incontriamoci] Session expired for ${username}; retrying ${operationName} after login.`);

        sessionCache.delete(getSessionKey(platform.bot, username));
        platform.cookie = null;
        platform.needRefresh = true;
        await platform.bot?.restartBrowser?.(`expired session during ${operationName}`);

        const cookies = await ensureSession(platform.bot, username);
        if (!cookies) {
            throw new Error(`Incontriamoci re-login returned no cookies before ${operationName}.`);
        }
        platform.cookie = cookies;

        // Retry exactly once. Any second failure is returned to the normal KO handling.
        return await operation();
    }
}

async function ensurePlatformBot(platform) {
    if (!platform || platform.platform !== "trovagnocca") return platform?.bot;
    if (!platform.bot) return null;
    if (typeof platform.bot?.publish === "function") return platform.bot;

    logger.Write(`Publisher WARNING: rebuilding Trovagnocca bot for ${platform.username || "unknown"} because publish() is missing`);
    console.warn("[trovagnocca] Rebuilding bot instance. Current bot shape:", {
        type: platform.bot?.constructor?.name,
        keys: platform.bot ? Object.keys(platform.bot) : []
    });

    const decryptedPassword = platform.password ? decryptPassword(platform.password) : "";
    platform.bot = new TrovagnoccaBot(platform.username, decryptedPassword, platform.credit, platform.platform);
    platform.cookie = await ensureSession(platform.bot, platform.username);
    platform.needRefresh = true;

    if (typeof platform.bot?.publish !== "function") {
        throw new Error("Trovagnocca bot publish() is unavailable after rebuild.");
    }

    return platform.bot;
}

function sendJson(res, statusCode, payload) {
    const body = JSON.stringify(payload);
    res.writeHead(statusCode, {
        "content-type": "application/json; charset=utf-8",
        "content-length": Buffer.byteLength(body)
    });
    res.end(body);
}

function readJsonBody(req) {
    return new Promise((resolve, reject) => {
        let body = "";
        req.on("data", (chunk) => {
            body += chunk;
            if (body.length > 1024 * 1024) {
                req.destroy();
                reject(new Error("Request body is too large."));
            }
        });
        req.on("end", () => {
            if (!body) return resolve({});
            try {
                resolve(JSON.parse(body));
            } catch (error) {
                reject(new Error("Invalid JSON request body."));
            }
        });
        req.on("error", reject);
    });
}

function normalizePublisherTimeSlots(timeSlots = []) {
    return [...new Set(
        (Array.isArray(timeSlots) ? timeSlots : [timeSlots])
            .map((slot) => parseInt(slot, 10))
            .filter(Number.isFinite)
    )];
}

function findPlatformByName(platformName, { username, groupId } = {}) {
    for (const group of groups) {
        if (groupId && `${group.id || ""}` !== `${groupId}`) continue;
        const platform = (group.platforms || []).find((candidate) => {
            if (candidate.platform !== platformName) return false;
            if (!username) return true;
            return `${candidate.username || ""}`.toLowerCase() === `${username}`.toLowerCase();
        });

        if (platform) return { group, platform };
    }

    return null;
}

function findTrovagnoccaPlatform(options = {}) {
    return findPlatformByName("trovagnocca", options);
}

function getErrorDetails(error) {
    if (!error) return null;
    const message = error.message || `${error}`;

    try {
        return JSON.parse(message);
    } catch {
        return message;
    }
}

function mergeTrovagnoccaClimbingCalendarPeriod(period, payload = {}) {
    const climbingCalendar = Array.isArray(payload.climbingCalendar)
        ? payload.climbingCalendar.filter(Boolean)
        : [];
    const dateTimeTop = payload.dateTimeTop || climbingCalendar.join(" - ");

    if (!dateTimeTop && !climbingCalendar.length) return period;

    try {
        const parsed = JSON.parse(period || "[]");
        if (Array.isArray(parsed) && parsed.length) {
            parsed[0] = {
                ...parsed[0],
                climbingCalendar,
                dateTimeTop
            };
            return JSON.stringify(parsed);
        }
    } catch {
        // Legacy period strings cannot safely carry metadata; keep them unchanged.
    }

    return period;
}

async function calculateTrovagnoccaPriceFromPublisher(payload = {}) {
    const numberDays = parseInt(payload.numberDays, 10) || 1;
    const productId = parseInt(payload.productId, 10) || 300;
    const timeSlots = normalizePublisherTimeSlots(payload.timeSlots);

    if (!timeSlots.length) {
        const error = new Error("At least one Trovagnocca time slot is required.");
        error.statusCode = 400;
        throw error;
    }

    const target = findTrovagnoccaPlatform({ username: payload.username });
    if (!target?.platform) {
        const error = new Error("No active Trovagnocca platform found in publisher.");
        error.statusCode = 404;
        throw error;
    }

    const { platform } = target;
    await ensurePlatformBot(platform);

    if (!platform.bot) {
        const error = new Error("Trovagnocca bot is not initialized.");
        error.statusCode = 503;
        throw error;
    }

    if (!platform.cookie) {
        platform.cookie = await ensureSession(platform.bot, platform.username);
        platform.needRefresh = true;
    }

    return await platform.bot.getPrice({ numberDays, timeSlots, productId });
}

function isMoscarossaSessionFailure(error) {
    const message = `${error?.message || error || ""}`.toLowerCase();
    return error?.statusCode === 401 || /moscarossa session.*expired|redirected? to login|login required/.test(message);
}

async function searchMoscarossaLocationsFromPublisher(payload = {}) {
    const term = `${payload.term || ""}`.replace(/\s+/g, " ").trim().slice(0, 80);
    if (term.length < 2) {
        const error = new Error("Moscarossa Comune search requires at least two characters.");
        error.statusCode = 400;
        throw error;
    }

    const target = findPlatformByName("moscarossa", {
        username: payload.username,
        groupId: payload.groupId
    });
    if (!target?.platform) {
        const error = new Error("No active Moscarossa platform found in publisher.");
        error.statusCode = 404;
        throw error;
    }

    const { platform } = target;
    if (!platform.bot || typeof platform.bot.searchLocations !== "function") {
        const error = new Error("Moscarossa location service is not initialized.");
        error.statusCode = 503;
        throw error;
    }

    if (platform.cookie && (!Array.isArray(platform.bot.cookies) || !platform.bot.cookies.length)) {
        const reused = await platform.bot.initWithCookies?.(platform.cookie);
        if (!reused) platform.cookie = null;
    }

    if (!platform.cookie) {
        platform.cookie = await ensureSession(platform.bot, platform.username);
        platform.needRefresh = true;
    }

    const search = () => platform.bot.searchLocations({
        term,
        idAccompa: payload.idAccompa
    });

    try {
        return await search();
    } catch (error) {
        if (!isMoscarossaSessionFailure(error)) throw error;

        logger.Write(`Publisher WARNING: Moscarossa session expired for ${platform.username}; re-login before Comune search.`);
        sessionCache.delete(getSessionKey(platform.bot, platform.username));
        platform.cookie = null;
        platform.needRefresh = true;
        await platform.bot.restartBrowser?.("expired session during Comune search");
        platform.cookie = await ensureSession(platform.bot, platform.username);
        return await search();
    }
}

async function runMoscarossaPhoneVerificationFromPublisher(payload = {}) {
    const action = `${payload.action || ""}`.trim().toLowerCase();
    const phone = `${payload.phone || ""}`.replace(/\D/g, "");
    const code = `${payload.code || ""}`.replace(/\D/g, "");
    const scheduleId = Number.parseInt(payload.scheduleId, 10) || 0;
    let remoteId = /^\d{4,9}$/.test(`${payload.remoteId || ""}`) ? `${payload.remoteId}` : "";

    if (!["send", "verify"].includes(action) || !/^\d{6,15}$/.test(phone)) {
        const error = new Error("Invalid Moscarossa phone verification request.");
        error.statusCode = 400;
        throw error;
    }
    if (action === "verify" && !/^\d{4,8}$/.test(code)) {
        const error = new Error("The Moscarossa SMS code must contain 4 to 8 digits.");
        error.statusCode = 400;
        throw error;
    }

    let schedule = null;
    if (scheduleId) {
        schedule = await ctx.tblSchedulazioni.findOne({
            where: { id: scheduleId, platform: "moscarossa", GCRecord: null }
        });
        if (!schedule) {
            const error = new Error("Moscarossa schedule not found.");
            error.statusCode = 404;
            throw error;
        }
        remoteId = remoteId || `${schedule.remotePostID || ""}`;
    }

    const target = findPlatformByName("moscarossa", {
        username: payload.username,
        groupId: payload.groupId
    });
    if (!target?.platform) {
        const error = new Error("No active Moscarossa platform found in publisher.");
        error.statusCode = 404;
        throw error;
    }
    const { platform } = target;
    if (!platform.bot || typeof platform.bot.sendPhoneVerification !== "function") {
        const error = new Error("Moscarossa phone verification service is not initialized.");
        error.statusCode = 503;
        throw error;
    }

    if (platform.cookie && (!Array.isArray(platform.bot.cookies) || !platform.bot.cookies.length)) {
        const reused = await platform.bot.initWithCookies?.(platform.cookie);
        if (!reused) platform.cookie = null;
    }
    if (!platform.cookie) {
        platform.cookie = await ensureSession(platform.bot, platform.username);
        platform.needRefresh = true;
    }

    const execute = async () => {
        if (action === "send") {
            return platform.bot.sendPhoneVerification({ phone, remoteId });
        }
        return platform.bot.verifyPhone({
            phone,
            code,
            remoteId,
            resume: Boolean(payload.resume && schedule),
            promotion: schedule ? {
                plan: schedule.typeAnnuncio || "Free",
                period: schedule.period || "",
                availableCredit: platform.credit
            } : {}
        });
    };

    let result;
    try {
        result = await execute();
    } catch (error) {
        if (!isMoscarossaSessionFailure(error)) throw error;
        logger.Write(`Publisher WARNING: Moscarossa session expired for ${platform.username}; re-login before phone verification.`);
        sessionCache.delete(getSessionKey(platform.bot, platform.username));
        platform.cookie = null;
        platform.needRefresh = true;
        await platform.bot.restartBrowser?.("expired session during phone verification");
        platform.cookie = await ensureSession(platform.bot, platform.username);
        result = await execute();
    }

    platform.cookie = JSON.stringify(platform.bot.cookies || []);
    platform.needRefresh = true;

    if (action === "send" && schedule && !schedule.remotePostID && result.remoteId) {
        await schedule.update({ remotePostID: result.remoteId });
    }
    if (action === "verify" && payload.resume && schedule && result.status === "published") {
        await schedule.update({
            state: "OK",
            remotePostID: result.remoteId || remoteId,
            urlBK: result.publicUrl || `https://www.moscarossa.biz/girl-${result.remoteId || remoteId}.php`,
            errorReason: null,
            payed: Number(result.creditsConsumed || 0) > 0
        });
    }

    return { ...result, scheduleId: schedule?.id || null };
}

function startPublisherApiServer() {
    if (publisherApiServer) return;

    publisherApiServer = http.createServer(async (req, res) => {
        const url = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);

        if (req.method === "GET" && url.pathname === "/health") {
            return sendJson(res, 200, { ok: true });
        }

        if (req.method === "POST" && url.pathname === "/api/trovagnocca/price") {
            try {
                const payload = await readJsonBody(req);
                const data = await calculateTrovagnoccaPriceFromPublisher(payload);
                return sendJson(res, 200, data);
            } catch (error) {
                const statusCode = error.statusCode || error.response?.status || 500;
                console.error("[publisher-api] Trovagnocca price error:", error);
                return sendJson(res, statusCode, {
                    error: "Unable to calculate Trovagnocca price.",
                    details: error.response?.data || getErrorDetails(error)
                });
            }
        }

        if (req.method === "POST" && url.pathname === "/api/moscarossa/locations") {
            try {
                const payload = await readJsonBody(req);
                const data = await searchMoscarossaLocationsFromPublisher(payload);
                return sendJson(res, 200, data);
            } catch (error) {
                const statusCode = error.statusCode || error.response?.status || 500;
                console.error("[publisher-api] Moscarossa Comune search error:", error);
                return sendJson(res, statusCode, {
                    error: "Unable to search Moscarossa Comuni.",
                    details: error.response?.data || getErrorDetails(error)
                });
            }
        }

        if (req.method === "POST" && url.pathname === "/api/moscarossa/phone-verification") {
            try {
                const payload = await readJsonBody(req);
                const data = await runMoscarossaPhoneVerificationFromPublisher(payload);
                return sendJson(res, 200, data);
            } catch (error) {
                const statusCode = error.statusCode || error.response?.status || 500;
                const log = statusCode === 409 && error.reasonCode === "MOSCAROSSA_REQUIRES_DRAFT"
                    ? console.warn
                    : console.error;
                log("[publisher-api] Moscarossa phone verification:", error.message || error);
                return sendJson(res, statusCode, {
                    error: error.message || "Unable to verify Moscarossa phone.",
                    reasonCode: error.reasonCode || null,
                    details: error.response?.data || getErrorDetails(error)
                });
            }
        }

        return sendJson(res, 404, { error: "Publisher API route not found." });
    });

    publisherApiServer.on("error", (error) => {
        publisherApiServer = null;
        console.error("[publisher-api] Server error:", error.message);
        logger.Write(`Publisher API ERROR: ${error.message}`);
    });

    publisherApiServer.listen(PUBLISHER_API_PORT, PUBLISHER_API_HOST, () => {
        const message = `[publisher-api] Listening on http://${PUBLISHER_API_HOST}:${PUBLISHER_API_PORT}`;
        console.log(message);
        logger.Write(message);
    });
}

async function CreateGroupsBot() {
    logger.Write(`[i] Test di connessione al database...`);
    try {
        //wait start db on server
        await ctx.model.authenticate();
        logger.Write(`[i] Connessione al database stabilita.`);
    } catch (error) {
        logger.Write(`Connessione al database NON riuscita, ritento la connessione...`);
        console.log('Unable to connect to the database:', error);
        return null;
    }

    var dbGroups = await ctx.tblGruppi.findAll({ where: { GCRecord: null } });
    var groupFiltered = new Array();

    console.log("[i] Numero di Gruppi Totale: " + dbGroups.length)

    for (const group of dbGroups) {
        var owner = await ctx.tblUser.findOne({ where: { OID: group.owner } });
        if (owner.isActive) {
            //Add platforms in groupFiltered by Zaharia
            var platforms = await ctx.tblPlatform.findAll({ where: { gruppi: group.id, status: 'active' }, raw: true })
            //Add BK in platforms
            platforms.push({
                id: "",
                platform: "bakecaincontrii",
                username: group.bkUserName,
                password: group.bkPassword,
                credit: group.bkCredit
            })
            // console.log(platforms, "platforms in CreateGroupsBot")
            group.platforms = platforms;
            groupFiltered.push(group);
        }
    }

    console.log("[i] Numero di Gruppi Attivi: " + groupFiltered.length)

    for (const group of groupFiltered) {
        logger.Write(`[i] Gruppo di lavoro "${group.name}" definito`);

        // Backecaincontrii Bot Setting
        if (group.bkPassword) {
            // Decrypt password
            var decrypted = decryptPassword(group.bkPassword);
            // Create a new bot instance for each group
            group.bot = await new BakecaincontriiBot(group.bkUserName, decrypted);
            group.overBusyBot = 0;

            // Create a new botCheckPhone instance for each group to avoid sharing
            //BUG DA FIXARE, RADOPPIA I BROWSER
            botCheckPhone = await new BakecaincontriiBot(group.bkUserName, decrypted);
        }

        /* 
            Other Platforms Bots Setting
            (Bakeca.it, Incontriamoci, Tovagnocca.com, Megaescort.info, Amasens.com, incontriescort.org)
        */
        if (group.platforms.length > 0) {
            await Promise.all(
                group.platforms.map(async (panel) => {
                    if (panel.username && (panel.password || panel.platform == "megaescort")) {
                        const decryptedPlatformPass = panel.password ? decryptPassword(panel.password) : "";
                        switch (panel.platform) {
                            case "bakeca":
                                panel.bot = await new BakecaBot(panel.username, decryptedPlatformPass, panel.credit, panel.platform)
                                panel.overBusyBot = 0
                                break;
                            case "megaescort":
                                panel.bot = await new MeBot(panel.username, panel.apiKey || decryptedPlatformPass, panel.credit, panel.platform)
                                panel.overBusyBot = 0
                                break;
                            case "trovagnocca":
                                panel.bot = await new TrovagnoccaBot(panel.username, decryptedPlatformPass, panel.credit, panel.platform)
                                panel.overBusyBot = 0
                                break;
                            case "incontriamoci":
                                panel.bot = await new IncontriamociBot(panel.username, decryptedPlatformPass, panel.credit, panel.platform)
                                panel.overBusyBot = 0
                                break;
                            case "amasens":
                                panel.bot = await new AmasensBot(panel.username, decryptedPlatformPass, panel.credit, panel.platform)
                                panel.overBusyBot = 0
                                break;
                            case "moscarossa":
                                panel.bot = await new MoscarossaBot(panel.username, decryptedPlatformPass, panel.credit, panel.platform)
                                panel.overBusyBot = 0
                                logger.Write(`Publisher INFO: Moscarossa free publishing is configured for ${panel.username}.`)
                                break;
                            default:
                                panel.bot = await new BakecaincontriiBot(panel.username, decryptedPlatformPass)
                                panel.overBusyBot = 0
                                break;
                        }
                    }
                    // console.log(group[panel.platform], "bakeca bot in group")
                })
            );
        }
        groups.push(group);
        // console.log(group, 'group in forEach')
    }
    return groups;
}

async function mainLoop(group, platform) {
    console.log(group.name, platform.platform, "group in mainLoop");
    if (group._mainLoopRunning) {
        console.log(`[i] Mainloop already running for ${group.name}, skipping overlapping tick.`);
        return;
    }
    group._mainLoopRunning = true;

    try {
        console.log(`[i] Mainloop ${platform.platform} in corso...` + group.name);

        const isBakecaincontrii = platform.platform == "bakecaincontrii";
        const activeBot = isBakecaincontrii ? group.bot : platform.bot;

        if (!activeBot) {
            return `No bot available for ${platform.platform}`;
        }

        const refreshOnlyWhenNeeded = ["bakeca", "trovagnocca"].includes(platform.platform);
        const shouldRefresh = !refreshOnlyWhenNeeded || platform.needRefresh !== false;
        if (shouldRefresh) {
            console.log('refresh', platform.platform);
            var cr = await activeBot.refresh2();         // get Credit andCookies

            // console.log(cr, platform.platform, 'refresh2 result')
            const refreshErr = cr && typeof cr === "object" && !Array.isArray(cr)
                ? (cr.err || cr.error || null)
                : null;

            if (refreshErr || !Array.isArray(cr) || !cr[1]) {
                const msg = refreshErr || "Invalid refresh2 payload";
                console.log(`[!] refresh2 failed for ${group.bkUserName}: ${msg}`);
                logger.Write(`Publisher WARNING: refresh2 failed for ${group.bkUserName}: ${msg}`);

                try {
                    //Update this section by Zaharia
                    let recoveredCookies;
                    if (platform.platform != 'bakecaincontrii') {
                        recoveredCookies = await ensureSession(platform.bot, platform.username);
                    } else {
                        recoveredCookies = await ensureSession(group.bot, group.bkUserName);
                    }

                    if (recoveredCookies) {
                        if (platform.platform != "bakecaincontrii") {
                            platform.cookie = recoveredCookies;
                            console.log(`[i] Session recovered for ${platform.username}`);
                        } else {
                            group.cookie = recoveredCookies;
                            platform.cookie = recoveredCookies;
                            console.log(`[i] Session recovered for ${group.bkUserName}`);
                        }
                    }
                } catch (recoveryErr) {
                    console.log(`[!] Session recovery failed for ${group.bkUserName} ${platform.platform}: ${recoveryErr?.message || recoveryErr}`);
                }
                return msg;
            }

            if (!isBakecaincontrii) {
                platform.cookie = cr[1];
                platform.credit = cr[0];
                if (refreshOnlyWhenNeeded) {
                    platform.needRefresh = false;
                }
                await ctx.tblPlatform.update(
                    { credit: cr[0] },                      // values to update
                    { where: { id: platform.id } }          // condition
                );
            } else {
                group.update({
                    bkCredit: cr[0],
                    coupon: cr[2]
                });
                group.cookie = cr[1];
                platform.cookie = cr[1];
                if (refreshOnlyWhenNeeded) {
                    platform.needRefresh = false;
                }
            }

            console.log("[i] Mainloop refreshed: ", cr[0]);
        } else {
            console.log(`[i] Mainloop refresh skipped for ${platform.platform}; waiting for schedule activity.`);
        }

        console.log(`[i] Bot Pronto ${new Date}`);

        group.overBusyBot = 0;
        var adss = [];
        var date_string = new Date().toUTCString();
        const day = new Date(date_string);
        var today = new Date(date_string);
        today.setHours(0, 0, 0, 0);
        console.log(`[i] Get Annunci ${new Date}`);

        // Add platformUsername by Zaharia
        var platformUsername = group.bkUserName;
        var annunci = await group.getTblAnnuncis({
            where: { GCRecord: null },
            include: [{
                model: ctx.tblSchedulazioni,
                required: true,
                where: {
                    GCRecord: null,
                    platform: platform.platform,
                    [Op.or]: [
                        { state: null, data: { [Op.gt]: today } },      // New Ads
                        { state: "EDIT" },                              //Update Ads
                        //{state: "ALERT", data: {[Op.gt]: today}},
                        { state: "CLOSE" },                             //Close Ads
                        { state: "REPUBLISH" },                         //Republish Ads by Zaharia
                        { state: "DELETE" }                             //Delete Ads
                    ]
                }
            }, {
                model: ctx.tblDonne,
                required: true
            }
            ]
        });

        console.log(`[i] preparo schedulazioni da pubblicare ${new Date}`);
        for (const annuncio of annunci) {
            console.log(`[i] ${new Date} annuncio n. Ads: ${annunci.length} schedules: ${annuncio.tblSchedulazionis.length} Ads: ${annuncio.id}`);

            for (var s of annuncio.tblSchedulazionis) {
                console.log('[i] schedule paltform: ', s.platform, platformUsername)

                // Add platformUsername by Zaharia
                if (s.platform != "bakecaincontrii") {
                    platformUsername = platform.username;
                }

                var pics = [];
                var picsAudit = []
                var t = s.data;
                t.setMinutes(t.getMinutes() + t.getTimezoneOffset());

                if (platform.platform != "bakecaincontrii") {//Add this section by Zaharia
                    var beforePlan = new Date(t);
                    // subtract 1 minutes
                    beforePlan.setMinutes(beforePlan.getMinutes() - 1);

                    if (Math.round(day.getTime() / 1000) > Math.round(beforePlan.getTime() / 1000) && Math.round(day.getTime() / 1000) < Math.round(t.getTime() / 1000)) {
                        platform.needRefresh = true; // refresh2 again for 1 min
                    }
                }

                //If Ads need to Publish or Update 
                if (Math.round(day.getTime() / 1000) > Math.round(t.getTime() / 1000) || s.state == "EDIT") {
                    var galleriaSchedulazione = await s.getTblGalleriaAnnuncios({
                        where: {
                            schedulazione: s.id,
                            GCRecord: null
                        },
                        order: [['isAnteprima', 'DESC']],
                        include: [{
                            model: ctx.tblGalleria,
                            required: true,
                            where: {
                                GCRecord: null
                            }
                        }]
                    });

                    console.log(galleriaSchedulazione.length, "gallery images length");
                    const picLimit = getPublishImageLimit(platform.platform);
                    for (const photo of galleriaSchedulazione) {
                        if (pics.length < picLimit) {
                            if (pics.includes(`${GLOBAL_PATH}/girls/${annuncio.tblDonne.phone}/pics/${photo.tblGallerium.origin}`) == false) {
                                picsAudit.push({
                                    path: `${GLOBAL_PATH}/girls/${annuncio.tblDonne.phone}/pics/${photo.tblGallerium.origin}`,
                                    applyPhone: photo.tblGallerium.applyPhone,
                                    crop: photo.tblGallerium.crop,
                                    isAnteprima: photo.isAnteprima === true
                                })
                                pics.push(`${GLOBAL_PATH}/girls/${annuncio.tblDonne.phone}/pics/${photo.tblGallerium.origin}`);
                            }
                        }
                    }

                    //Add platformUsername by Zaharia
                    s.username = platformUsername;

                    s.picsAudit = picsAudit;
                    s.pics = pics;
                    s.title = annuncio.title;
                    s.nickname = annuncio.nickname;
                    s.name = annuncio.tblDonne?.name || "";
                    //SERVIZI
                    s.serviceAfricana = annuncio.serviceAfricana;
                    s.serviceIndiana = annuncio.serviceIndiana;
                    s.serviceAsiatica = annuncio.serviceAsiatica;
                    s.serviceAraba = annuncio.serviceAraba;
                    s.serviceLatina = annuncio.serviceLatina;
                    s.serviceCaucasica = annuncio.serviceCaucasica;
                    s.serviceItaliana = annuncio.serviceItaliana;
                    s.serviceSNaturale = annuncio.serviceSNaturale;
                    s.serviceSRifatto = annuncio.serviceSRifatto;
                    s.serviceCBiondi = annuncio.serviceCBiondi;
                    s.serviceCMarroni = annuncio.serviceCMarroni;
                    s.serviceCNeri = annuncio.serviceCNeri;
                    s.serviceCRossi = annuncio.serviceCRossi;
                    s.serviceMagro = annuncio.serviceMagro;
                    s.serviceFormoso = annuncio.serviceFormoso;

                    s.hourlyPrice = annuncio.hourlyPrice;
                    s.serviceCash = annuncio.serviceCash;
                    s.serviceCreditCard = annuncio.serviceCreditCard;

                    s.serviceNazionalita = annuncio.serviceNazionalita;
                    s.serviceOrale = annuncio.serviceOrale;
                    s.serviceAnale = annuncio.serviceAnale;
                    s.serviceSadomaso = annuncio.serviceSadomaso;
                    s.serviceEsperienzaFidanzata = annuncio.serviceEsperienzaFidanzata;
                    s.serviceAttriciPorno = annuncio.serviceAttriciPorno;
                    s.serviceEiaculazioneSulCorpo = annuncio.serviceEiaculazioneSulCorpo;
                    s.serviceMassaggioErotico = annuncio.serviceMassaggioErotico;
                    s.serviceMassaggioTantrico = annuncio.serviceMassaggioTantrico;
                    s.serviceFetish = annuncio.serviceFetish;
                    s.serviceBacioAllaFrancese = annuncio.serviceBacioAllaFrancese;
                    s.serviceGiocoDiRuolo = annuncio.serviceGiocoDiRuolo;
                    s.serviceTrio = annuncio.serviceTrio;
                    s.serviceSexting = annuncio.serviceSexting;
                    s.serviceVideoChiamata = annuncio.serviceVideoChiamata;

                    s.serviceUomini = annuncio.serviceUomini;
                    s.serviceDonne = annuncio.serviceDonne;
                    s.serviceCoppie = annuncio.serviceCoppie;
                    s.serviceDisabili = annuncio.serviceDisabili;
                    s.serviceACasa = annuncio.serviceACasa;
                    s.serviceEventiEFeste = annuncio.serviceEventiEFeste;
                    s.serviceAlbergoMotel = annuncio.serviceAlbergoMotel;
                    s.serviceClubs = annuncio.serviceClubs;
                    s.serviceVisitaADomicilio = annuncio.serviceVisitaADomicilio;

                    //Se schedulazione non contiene città, usa quella dell'annuncio
                    s.annunci_city = annuncio.city; //Add by Zaharia
                    if (s.platform === "amasens" && s.state === "EDIT") {
                        s.city = annuncio.city;
                    } else if (!s.city) {
                        s.city = annuncio.city;
                    }
                    s.location = annuncio.location;
                    s.age = annuncio.tblDonne.years;
                    s.description = annuncio.description;
                    s.note = annuncio.note;
                    s.phone = annuncio.tblDonne.phone;
                    s.whatsapp = annuncio.hasWhatapp;
                    s.telegram = annuncio.hasTelegram;
                    s.hasVideo = annuncio.serviceVideoChiamata;
                    s.categorie = annuncio.categorie;

                    s.sono = annuncio.sono; //add by zaharia

                    s.time = t.toISOString().split("T")[1].split(":00.")[0];
                    s.promo = {
                        active: s.typeAnnuncio !== "Free",
                        visibility: s.typeAnnuncio,
                        schedule: s.period,
                        premium: s.hasPremium,
                        etichetta: s.hasEtichetta,
                        highlight: s.hasHighlight,
                        cam: s.hasVideo
                    }
                    adss.push(s);
                    console.log(`${new Date} schedulazione n. ${s.id}`);
                }
            }
        }

        if (adss.length > 0) {
            console.log(`[i] ${new Date} Bot Occupato n. ${group.overBusyBot} volte`);
        }

        for (var ad of adss) {
            group.overBusyBot = group.overBusyBot + 1
            //console.log("\n ad.state in MAIN LOOP",ad);
            const attemptState = { errorReason: null };
            if (ad.state != "CLOSE" && ad.state != "DELETE") {
                attemptState.state = "ALERT";
            }
            await ctx.tblSchedulazioni.update(attemptState, { where: { id: ad.id } });

            if (ad.state == "CLOSE") {
                //add in tblSchedulazioni expiry date based on the package they got 
                //Bakecaincontrii -> Free, 1x1, 1x3, 1x7, 10x1, 10x3, 10x7
                //Bakeca -> Free, 1x1, 1x3, 1x7, 1x14, 1x28, 3x1, 3x3, 3x7, 3x14, 3x28
                var expiryDate = new Date(ad.data);

                //Update expireDate
                // if (ad.typeAnnuncio !== 'Free') {
                //     const periodFromType = getLastNumber(ad.typeAnnuncio);
                //     expiryDate.setDate(expiryDate.getDate() + periodFromType - 1);
                // }

                switch (ad.typeAnnuncio) {
                    case "1x1":
                    case "10x1":
                        expiryDate.setDate(expiryDate.getDate() + 2); // third day
                        break;
                    case "1x3":
                    case "10x3":
                        expiryDate.setDate(expiryDate.getDate() + 4); // fifth day
                        break;
                    case "1x7":
                    case "10x7":
                        expiryDate.setDate(expiryDate.getDate() + 8); // ninth day
                        break;
                }

                // Convert expiryDate to epoch (milliseconds)
                const expiryEpoch = expiryDate.getTime();

                if (ad.state == "CLOSE") {
                    console.log(`${new Date} ad.state is CLOSE, closing ad`);
                } else {
                    ad.state = "CLOSED";
                    await ad.update({
                        data: ad.data,
                        state: "CLOSED",
                        expiryEpoch: expiryEpoch
                    }, { where: { id: ad.id } });
                }
                //await ctx.tblSchedulazioni.update({state: "CLOSED"}, {where: {id: ad.id}});
            } else if (ad.state == "DELETE") {
                console.log(`${new Date} ad.state is DELETE, deleting ad`);
            }
        }

        var limitPostInTime = 3;
        var postInTime = 0;
        for (var ad of adss) {
            //console.log(`${new Date} Trovato ${adss.length} ads`);
            if (postInTime < (limitPostInTime - 1)) {
                postInTime = postInTime + 1;
                console.log("postthis 1. activated")
                await postThis(ad, group, platform);
            } else {
                console.log("postthis 2. activated")

                await postThis(ad, group, platform);
                postInTime = 0;
                //var cred = await group.bot.refresh2();
                //group.cookie = cred[1]
            }
        }
        if (group.overBusyBot == 0) console.log(`[i] ${new Date} Bot libero`);
    } finally {
        group._mainLoopRunning = false;
    }
};

const MAX_PUBLISH_ERROR_REASON_LENGTH = 2000;

function formatPublishErrorReason(error, fallback = "La pubblicazione non e riuscita.") {
    let source = error;
    if (source && typeof source === "object" && !(source instanceof Error)) {
        source = source.error || source.reason || source.message || source;
    }

    let reason;
    if (source instanceof Error) {
        reason = source.message;
    } else if (typeof source === "string") {
        reason = source;
    } else {
        try {
            reason = JSON.stringify(source);
        } catch (_) {
            reason = "";
        }
    }

    reason = `${reason || ""}`.replace(/\s+/g, " ").replace(/^(?:Error:\s*)+/i, "").trim();

    const jsonStart = reason.indexOf("{");
    if (jsonStart >= 0) {
        try {
            const details = JSON.parse(reason.slice(jsonStart));
            const validationMessage = Array.isArray(details.validationText)
                ? details.validationText.find((message) => `${message || ""}`.trim())
                : "";
            const conciseDetail = validationMessage || details.message || details.reason || details.error;
            if (conciseDetail) reason = `${conciseDetail}`.replace(/\s+/g, " ").trim();
        } catch (_) {
            // Keep the original message when the suffix is not valid JSON.
        }
    }

    return (reason || fallback).slice(0, MAX_PUBLISH_ERROR_REASON_LENGTH);
}

function requireSuccessfulOperation(result, operationName) {
    if (result?.ok) return result;
    throw new Error(formatPublishErrorReason(result, `${operationName} non riuscita.`));
}

async function postThis(ad, group, platform) {
    let remotePostID = null;
    let pubStatus = "OK";
    let errorReason = null;
    let uriDateTimes = { uri: "", datetimes: [], err: null };
    let dateGetted = "";

    console.log(`${new Date()} Starting postThis for ad ID: ${ad.state}-${ad.id}-${platform.platform}`);
    if (platform.platform == 'bakecaincontrii') {
        try {
            // Start the state handling
            switch (ad.state) {
                case "EDIT":
                    logger.Write(`Publisher: Modifying ad n. ${ad.annuncio}, schedule n. ${ad.id}, group ${group.id}`);
                    remotePostID = ad.remotePostID;
                    if (!remotePostID) throw new Error('remotePostID is missing in EDIT state.');

                    console.log(`${new Date()} Modifying schedule ${ad.id}`);
                    try {
                        await group.bot.edit(ad, group.cookie);
                        console.log(`${new Date()} Edit finished for schedule ${ad.id}`);
                        logger.Write(`Edit successful: https://bari.bakecaincontrii.com/u/post-manage/${remotePostID}/`);
                    } catch (editError) {
                        throw new Error(`Failed to edit ad: ${editError}`);
                    }
                    break;
                case "CLOSE":
                    logger.Write(`Publisher: Suspending ad n. ${ad.annuncio}, schedule n. ${ad.id}, group ${group.id}`);
                    console.log(`${new Date()} Suspending publication: ${ad.id}`);
                    if (ad.remotePostID) {
                        try {
                            await group.bot.sendRequestSuspend(ad.remotePostID, (error) => {
                                if (error) console.error("Suspension error:", error);
                                console.log(`${new Date()} Publication suspended for ${ad.id}`);
                            }, group.cookie);
                        } catch (suspendError) {
                            console.error("Failed to suspend ad:", suspendError);
                        }
                    } else {
                        console.log(`${new Date()} remotePostID not found for schedule ${ad.id}`);
                    }
                    pubStatus = "CLOSED";
                    break;
                default:
                    logger.Write(`Publisher: Publishing ad n. ${ad.annuncio}, schedule n. ${ad.id}, group ${group.id} at ${new Date()}`);
                    console.log(`${new Date()} Inserting schedule ${ad.id}`);
                    if (!published.includes(ad.id)) {
                        published.push(ad.id);
                        try {
                            remotePostID = await group.bot.publish(ad, group.cookie);
                            console.log(`${new Date()} Insertion complete for schedule ${ad.id}`);
                            logger.Write(`Publish successful: https://bari.bakecaincontrii.com/u/post-manage/${remotePostID}/`);
                        } catch (publishError) {
                            throw new Error(`Failed to publish ad: ${publishError}`);
                        }
                    } else {
                        console.log(`${new Date()} Schedule ${ad.id} is a duplicate, skipping...`);
                        await ad.update({ state: "OK", errorReason: null });
                        logger.Write(`${new Date()} Schedule ${ad.id} duplicate, skipped.`);
                        sleep(3);
                        if (group.overBusyBot > 0) group.overBusyBot -= 1;
                        return null;
                    }
            }
        } catch (error) {
            console.error("Error in postThis state handling:", error);
            const index = published.indexOf(ad.id);
            if (index > -1) {
                published.splice(index, 1);
            }
            pubStatus = "KO";
            errorReason = formatPublishErrorReason(error);
            logger.Write(`Publisher ERROR during operation: ${error.stack || error}`);
        }

        try {
            if (pubStatus !== "CLOSED") {
                console.log(`${new Date()} Starting URI capture for schedule ${ad.id}`);
                if (remotePostID) {
                    console.log("Cattura URI e Date");
                    uriDateTimes = await group.bot.getDatetimes(remotePostID, ad.typeAnnuncio === "FREE", group.cookie);
                    console.log({ uriDateTimes });

                    if (uriDateTimes.err || !uriDateTimes.uri) {
                        console.log("Errore Cattura URI e Date");
                        uriDateTimes.err = null;
                        uriDateTimes = await group.bot.getDatetimes(remotePostID, true, group.cookie);
                        if (uriDateTimes.err) throw new Error("NOT FOUND");
                    }
                    console.log(`${new Date()} Fine cattura URI ${ad.id}`);
                    console.log("Cattura URI e Date OK");
                }

                logger.Write(uriDateTimes.uri || "No URI captured");
                console.log(`${new Date()} Captured URI: ${uriDateTimes.uri || "No URI"} - Schedule ID: ${ad.id}`);
                dateGetted = Array.isArray(uriDateTimes.datetimes) ? uriDateTimes.datetimes.join(' - ') : "No datetimes available";
                console.log(`${new Date()} Saving data: ${pubStatus}, ${remotePostID}, ${dateGetted}, Schedule ID: ${ad.id}`);
                //if remotepostid = bari.bakecaincontrii.com only then make pubstatus BLOCKED
                if (remotePostID && remotePostID === "bari.bakecaincontrii.com") {
                    pubStatus = "BLOCKED";
                    pagato = false;
                } else {
                    pagato = true;
                }

                if (remotePostID == null) {
                    pubStatus = "KO";
                    errorReason = errorReason || "La pubblicazione non ha restituito un identificativo remoto.";
                    pagato = false;
                }

                try {
                    await ad.update({
                        state: pubStatus,
                        payed: pagato,
                        remotePostID: remotePostID,
                        urlBK: uriDateTimes.uri,
                        dateTimeTop: dateGetted,
                        errorReason: pubStatus === "KO" ? errorReason : null
                    });
                } catch (dbUpdateError) {
                    console.error("Error updating ad in the database:", dbUpdateError);
                }
            }
        } catch (err) {
            console.error("Error during URI and datetime handling:", err);
            console.log("Saving state without capturing URI and datetime.");
            console.log(`${new Date()} Saving data: ${pubStatus}, ${remotePostID}, No additional info, Schedule ID: ${ad.id}`);
            try {
                await ad.update({
                    state: pubStatus,
                    remotePostID: remotePostID,
                    errorReason: pubStatus === "KO" ? errorReason : null
                });
            } catch (finalDbUpdateError) {
                console.error("Final database update failed:", finalDbUpdateError);
            }
        }

        try {
            // Final state update
            await ad.update({
                state: pubStatus,
                remotePostID: remotePostID,
                urlBK: uriDateTimes.uri,
                dateTimeTop: dateGetted,
                errorReason: pubStatus === "KO" ? errorReason : null
            });
        } catch (finalStateUpdateError) {
            console.error("Final update of ad state failed:", finalStateUpdateError);
        }
        platform.needRefresh = true;
        console.log("Final pubStatus:", pubStatus);
        if (group.overBusyBot > 0) group.overBusyBot -= 1;
    } else {
        try {
            console.log(ad.state, `${platform.platform} ad management`);
            await ensurePlatformBot(platform);
            switch (ad.state) {
                case 'EDIT':
                    logger.Write(`Publisher: Updating Bakeca ad n. ${ad.annuncio}, schedule n. ${ad.id}, group ${group.id}`);
                    if (!ad.remotePostID) {
                        ad.remotePostID = await platform.bot.resolveRemoteId(ad);
                    }
                    if (!ad.remotePostID) {
                        throw new Error(`Bakeca remotePostID missing for EDIT state on schedule ${ad.id}`);
                    }

                    const updateResult = requireSuccessfulOperation(await runWithIncontriamociSessionRecovery(
                        platform,
                        "update",
                        () => platform.bot.update(ad, group, platform)
                    ), `${platform.platform} update`);
                    console.log(`${new Date()} Bakeca update result for schedule ${ad.id}:`, updateResult);
                    pubStatus = "OK";
                    platform.needRefresh = true;
                    break;
                case 'DELETE':
                    logger.Write(`Publisher: Deleting Bakeca ad n. ${ad.annuncio}, schedule n. ${ad.id}, group ${group.id}`);
                    if (!ad.remotePostID) {
                        ad.remotePostID = await platform.bot.resolveRemoteId(ad);
                    }
                    if (!ad.remotePostID) {
                        throw new Error(`Bakeca remotePostID missing for DELETE state on schedule ${ad.id}`);
                    }

                    const deleteResult = requireSuccessfulOperation(await runWithIncontriamociSessionRecovery(
                        platform,
                        "delete",
                        () => platform.bot.delete(ad.remotePostID, platform.platform)
                    ), `${platform.platform} delete`);
                    console.log(`${new Date()} Bakeca delete result for schedule ${ad.id}:`, deleteResult);
                    pubStatus = "DELETED";
                    platform.needRefresh = true;
                    break;
                case 'CLOSE':
                    logger.Write(`Publisher: Suspending Bakeca ad n. ${ad.annuncio}, schedule n. ${ad.id}, group ${group.id}`);
                    if (!ad.remotePostID) {
                        ad.remotePostID = await platform.bot.resolveRemoteId(ad);
                    }
                    if (!ad.remotePostID) {
                        throw new Error(`Bakeca remotePostID missing for CLOSE state on schedule ${ad.id}`);
                    }

                    const suspendResult = requireSuccessfulOperation(await runWithIncontriamociSessionRecovery(
                        platform,
                        "suspend",
                        () => platform.bot.suspend(ad.remotePostID, ad, platform.platform)
                    ), `${platform.platform} suspend`);
                    console.log(`${new Date()} Bakeca suspend result for schedule ${ad.id}:`, suspendResult);
                    pubStatus = "CLOSED";
                    platform.needRefresh = true;
                    break;
                case 'REPUBLISH':
                    logger.Write(`Publisher: Republishing Bakeca ad n. ${ad.annuncio}, schedule n. ${ad.id}, group ${group.id}`);
                    if (!ad.remotePostID) {
                        ad.remotePostID = await platform.bot.resolveRemoteId(ad);
                    }
                    if (!ad.remotePostID) {
                        throw new Error(`Bakeca remotePostID missing for REPUBLISH state on schedule ${ad.id}`);
                    }

                    const rePublishResult = requireSuccessfulOperation(await runWithIncontriamociSessionRecovery(
                        platform,
                        "republish",
                        () => platform.bot.republish(ad.remotePostID, ad, platform.platform)
                    ), `${platform.platform} republish`);
                    console.log(`${new Date()} Bakeca republish result for schedule ${ad.id}:`, rePublishResult);
                    pubStatus = "OK";
                    platform.needRefresh = true;
                    break;
                default:
                    const result = requireSuccessfulOperation(await runWithIncontriamociSessionRecovery(
                        platform,
                        "publish",
                        () => platform.bot.publish(ad, group, platform)
                    ), `${platform.platform} publish`);
                    console.log(result);
                    pubStatus = "OK";
                    ad.remotePostID = result?.payload?.idpriv || result?.megaId || null
                    ad.urlBK = result?.url || null;
                    ad.payed = Number(result?.creditsConsumed || 0) > 0;
                    if (platform.platform === "moscarossa" && Number.isFinite(Number(result?.remainingCredit))) {
                        platform.credit = Number(result.remainingCredit);
                    }
                    if (platform.platform === "trovagnocca" && result?.payload?.dateTimeTop) {
                        ad.dateTimeTop = result.payload.dateTimeTop;
                        ad.period = mergeTrovagnoccaClimbingCalendarPeriod(ad.period, result.payload);
                    }
                    platform.needRefresh = true;
                    break;
            }

            await ad.update({
                state: pubStatus,
                remotePostID: ad.remotePostID,
                urlBK: ad.urlBK,
                payed: ad.payed,
                dateTimeTop: ad.dateTimeTop,
                period: ad.period,
                errorReason: null
            });
        } catch (bakecaActionError) {
            const pendingMoscarossaAction = platform.platform === "moscarossa" &&
                bakecaActionError?.scheduleState === "ALERT";
            pubStatus = pendingMoscarossaAction ? "ALERT" : "KO";
            if (bakecaActionError?.remoteId) ad.remotePostID = `${bakecaActionError.remoteId}`;
            if (bakecaActionError?.url) ad.urlBK = bakecaActionError.url;
            errorReason = formatPublishErrorReason(bakecaActionError);
            console.error(`Error in ${platform.platform} postThis state handling:`, bakecaActionError);
            logger.Write(`Publisher ERROR during ${platform.platform} operation: ${bakecaActionError.stack || bakecaActionError}`);
            try {
                await ad.update({
                    state: pubStatus,
                    remotePostID: ad.remotePostID || null,
                    urlBK: ad.urlBK || null,
                    errorReason
                });
                console.log(
                    `[${platform.platform}] Saved schedule ${ad.id} with state ${pubStatus}` +
                    (ad.remotePostID ? ` and remote ID ${ad.remotePostID}` : "")
                );
            } catch (failureStateUpdateError) {
                console.error(
                    `[${platform.platform}] Failed to save ${pubStatus} state for schedule ${ad.id}:`,
                    failureStateUpdateError
                );
            }
        }

        if (group.overBusyBot > 0) group.overBusyBot -= 1;
        console.log(`Final ${platform.platform} pubStatus:`, pubStatus);
    }
}

const sendContactVerifyRequest = (bot, data, cookies) => new Promise((resolve, reject) => {
    bot.sendRequest(data, (err, res, body) => {
        if (err) return reject(err);
        resolve({ res, body });
    }, cookies);
});

const contactVerifySucceeded = (res, body) => {
    try {
        return JSON.parse(body).success === "OK";
    } catch (err) {
        return res?.statusCode === 204;
    }
};

async function contactVerifyLoop(bot, cookies) {
    if (phoneCheckRunning) {
        console.log("[i] Phone verification is still running; skipping overlapping cycle.");
        return;
    }

    phoneCheckRunning = true;
    try {
        if (bot.refresh) await bot.refresh();

        const operations = await ctx.tblContactVerifyBakeca.findAll({
            where: { action: { [Op.notLike]: "checked" } }
        });

        for (const operation of operations) {
            const basicInfo = {
                contact: "+39" + operation.phone,
                city: cities[operation.city],
            };

            try {
                if (operation.action == "check" && !operation.status) {
                    const checkResult = await sendContactVerifyRequest(bot, {
                        ...basicInfo,
                        action: "check",
                    }, cookies);
                    const success = contactVerifySucceeded(checkResult.res, checkResult.body);
                    console.log(`Check completed. Approved: ${success}`);

                    if (success) {
                        operation.status = true;
                        operation.approved = true;
                        operation.action = "checked";
                        await updateOperation(operation);
                        continue;
                    }

                    const codeResult = await sendContactVerifyRequest(bot, {
                        ...basicInfo,
                        action: "send_code",
                        captchaResponse: undefined
                    }, cookies);
                    operation.status = true;
                    console.log(codeResult.res?.statusCode === 200 ? "Code sent." : "Code request completed without success.");
                    await updateOperation(operation);
                } else if (operation.action === "code" && !operation.status) {
                    const verifyResult = await sendContactVerifyRequest(bot, {
                        ...basicInfo,
                        action: "verify_code",
                        code: operation.code,
                    }, cookies);
                    const success = contactVerifySucceeded(verifyResult.res, verifyResult.body);
                    console.log(success ? "Code approved." : "Code not approved.");
                    if (success) {
                        operation.approved = true;
                        operation.action = "checked";
                    }
                    operation.status = true;
                    await updateOperation(operation);
                }
            } catch (operationError) {
                console.error(`[!] Phone verification operation ${operation.id} failed:`, operationError?.message || operationError);
                logger.Write(`Publisher ERROR PHONE OP ${operation.id}: ${operationError?.message || operationError}`);
            }
        }
    } finally {
        phoneCheckRunning = false;
    }
}

function scheduleNextPhoneCheck(bot, cookies, generation, delayMs = 10000) {
    if (generation !== phoneCheckSchedulerGeneration) return;
    checkPhoneMailLoop = setTimeout(async () => {
        if (generation !== phoneCheckSchedulerGeneration) return;
        try {
            await contactVerifyLoop(bot, cookies);
        } catch (err) {
            console.error("[!] Phone verification cycle failed:", err?.message || err);
            logger.Write(`Publisher ERROR PHONE LOOP: ${err?.message || err}`);
        } finally {
            scheduleNextPhoneCheck(bot, cookies, generation, 10000);
        }
    }, delayMs);
}

async function stopCheckPhoneBot() {
    phoneCheckSchedulerGeneration += 1;
    if (checkPhoneMailLoop) {
        clearTimeout(checkPhoneMailLoop);
        checkPhoneMailLoop = null;
    }
    while (phoneCheckRunning) await wait(100);
}

async function startCheckPhoneBot() {
    await stopCheckPhoneBot();
    if (!botCheckPhone) return;

    const generation = phoneCheckSchedulerGeneration;
    try {
        const cookies = await ensureSession(botCheckPhone, botCheckPhone.email);
        if (generation !== phoneCheckSchedulerGeneration) return;
        logger.Write(`Publisher say: Bot per la verifica del numero di telefono ha eseguito il login.`);
        scheduleNextPhoneCheck(botCheckPhone, cookies, generation, 0);
    } catch (err) {
        console.log(err);
        logger.Write(`Publisher ERROR: ${err}`);
        await closeBotBrowser(botCheckPhone, "check-phone login failure");
        if (generation === phoneCheckSchedulerGeneration) {
            checkPhoneMailLoop = setTimeout(() => startCheckPhoneBot(), 3000);
        }
    }
}

async function runGroupLoop(group) {
    if (group._groupLoopRunning) return;
    group._groupLoopRunning = true;

    while (true) {
        const startTime = new Date();
        console.log(`[GROUP START] ${group.name || group.id} → ${startTime.toISOString()}`);

        try {
            if (!group.platforms || group.platforms.length === 0) {
                console.log(`No platforms found for group ${group.name || group.id}`);
                await wait(30000);
                continue;
            }

            for (const platform of group.platforms) {
                try {
                    await ensurePlatformBot(platform);

                    if (!platform.bot) {
                        console.log(`No bot found for platform ${platform.platform}`);
                        continue;
                    }

                    if (platform.platform == "megaescort" && !platform.apiKey) {
                        console.log(`[Me] Getting AdSpeed API key for ${platform.username}`);
                        const result = await getApiKey(platform.username, {
                            saveResult: false
                        });

                        if (!result?.apiKey) {
                            throw new Error("AdSpeed API response did not include x-api-key.");
                        }

                        // console.log(result, 'apiKey result from API');
                        const apiUser = result.apiUser || platform.username;
                        platform.apiKey = result.apiKey;
                        platform.apiUser = apiUser;
                        platform.bot.apiKey = result.apiKey;
                        platform.bot.password = result.apiKey;
                        platform.bot.apiUser = apiUser;
                        platform.bot.email = apiUser;
                    }

                    if (!platform.cookie) {
                        console.log("Platform in runGroupLoop:", platform.platform);

                        const isBakecaincontrii = platform.platform == "bakecaincontrii";
                        const activeBot = isBakecaincontrii ? group.bot : platform.bot;
                        const activeUsername = isBakecaincontrii ? group.bkUserName : platform.username;
                        const cookie = await ensureSession(activeBot, activeUsername);
                        platform.needRefresh = true;

                        if (cookie) {
                            platform.cookie = cookie;
                            if (isBakecaincontrii) {
                                group.cookie = cookie;
                            }
                            logger.Write(`Publisher INFO: login success for ${group.name || group.id} / ${platform.platform}`);
                        } else {
                            logger.Write(`Publisher WARNING: no cookie returned for ${group.name || group.id} / ${platform.platform}`);
                            continue;
                        }
                    }

                    await mainLoop(group, platform);

                } catch (platformError) {
                    console.log(platformError);
                    logger.Write(`Publisher ERROR: ${platformError}`);
                    logger.Write(`Try restart bot of group ${group.name || group.id} platform ${platform.platform}`);

                    platform.cookie = null;
                    platform.needRefresh = true;

                    if (platform.bot) {
                        await closeBotBrowser(
                            platform.bot,
                            `platform loop failure ${group.name || group.id || "unknown"} - ${platform.platform}`
                        );
                    }

                    await wait(3000);
                }
            }
        } catch (groupError) {
            console.log(groupError);
            logger.Write(`Publisher ERROR GROUP: ${groupError}`);
        }

        const endTime = new Date();
        console.log(`[GROUP END] ${group.name || group.id} → ${endTime.toISOString()}`);
        console.log(`[GROUP WAIT] 30s...`);

        await wait(30000);
    }
}

async function startAllGroupLoops(groups) {
    for (const group of groups) {
        runGroupLoop(group); // no await
    }
}

// The website uses this API for Moscarossa Comune resolution. Start it before
// database/bot initialization so a slow or failed bot startup does not leave
// the local service unavailable.
startPublisherApiServer();

CreateGroupsBot().then(async (groups) => {
    if (groups) {
        await startCheckPhoneBot();
        await startAllGroupLoops(groups);

        setInterval(async () => {
            if (phoneCheckRestarting) return;
            phoneCheckRestarting = true;
            try {
                await stopCheckPhoneBot();
                sessionCache.delete(getSessionKey(botCheckPhone, botCheckPhone?.email));
                await closeBotBrowser(botCheckPhone, "scheduled phone-check recycle");
                await startCheckPhoneBot();
            } finally {
                phoneCheckRestarting = false;
            }
        }, (1000 * 60 * 120));
    }
});
