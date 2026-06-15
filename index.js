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
var checkPhoneMailLoop;
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
let publisherApiServer = null;

const getLastNumber = (str) => {
    const parts = str.split("x");
    return parseInt(parts[1], 10);
}

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
    const cached = sessionCache.get(email);
    // console.log(cached, "platform cached")
    if (cached) {//If Cookies has
        const ok = await bot.initWithCookies?.(cached);
        if (ok) return cached;
        sessionCache.delete(email);
    }

    // console.log(bot.email, bot.password, sessionInflight, 'ensureSession2');
    if (sessionInflight.has(email)) {//If Login finished
        const cookies = await sessionInflight.get(email);
        const ok = await bot.initWithCookies?.(cookies);
        if (ok) return cookies;
        sessionCache.delete(email);
    }
    // console.log(bot.email, bot.password, 'ensureSession3')
    const loginPromise = (async () => {
        let unsolvableAttempt = 0;
        while (true) {
            try {
                const cookies = await runLimitedLogin(() => bot.login());
                if (cookies) sessionCache.set(email, cookies);
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
        sessionInflight.delete(email);
    });

    // console.log(bot.email, bot.password, 'ensureSession4')
    sessionInflight.set(email, loginPromise);
    return await loginPromise;
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

function findTrovagnoccaPlatform({ username } = {}) {
    for (const group of groups) {
        const platform = (group.platforms || []).find((candidate) => {
            if (candidate.platform !== "trovagnocca") return false;
            if (!username) return true;
            return `${candidate.username || ""}`.toLowerCase() === `${username}`.toLowerCase();
        });

        if (platform) return { group, platform };
    }

    return null;
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

function startPublisherApiServer() {
    if (publisherApiServer) return;

    publisherApiServer = http.createServer(async (req, res) => {
        const url = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);

        if (req.method === "GET" && url.pathname === "/health") {
            return sendJson(res, 200, { ok: true });
        }

        if (req.method !== "POST" || url.pathname !== "/api/trovagnocca/price") {
            return sendJson(res, 404, { error: "Publisher API route not found." });
        }

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
    });

    publisherApiServer.on("error", (error) => {
        publisherApiServer = null;
        console.error("[publisher-api] Server error:", error.message);
        logger.Write(`Publisher API ERROR: ${error.message}`);
    });

    publisherApiServer.listen(PUBLISHER_API_PORT, "127.0.0.1", () => {
        const message = `[publisher-api] Listening on http://127.0.0.1:${PUBLISHER_API_PORT}`;
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
                    let picLimit = platform.platform === "trovagnocca" ? 6 : 5
                    for (const photo of galleriaSchedulazione) {
                        if (pics.length < picLimit) {
                            if (pics.includes(`${GLOBAL_PATH}/website/girls/${annuncio.tblDonne.phone}/pics/${photo.tblGallerium.origin}`) == false) {
                                picsAudit.push({
                                    path: `${GLOBAL_PATH}/website/girls/${annuncio.tblDonne.phone}/pics/${photo.tblGallerium.origin}`,
                                    applyPhone: photo.tblGallerium.applyPhone,
                                    crop: photo.tblGallerium.crop,
                                    isAnteprima: photo.isAnteprima === true
                                })
                                pics.push(`${GLOBAL_PATH}/website/girls/${annuncio.tblDonne.phone}/pics/${photo.tblGallerium.origin}`);
                            }
                        }
                    }

                    //Add platformUsername by Zaharia
                    s.username = platformUsername;

                    s.picsAudit = picsAudit;
                    s.pics = pics;
                    s.title = annuncio.title;
                    s.nickname = annuncio.nickname;
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
                    if (!s.city) s.city = annuncio.city;
                    s.location = annuncio.location;
                    s.age = annuncio.tblDonne.years;
                    s.description = annuncio.description;
                    s.note = annuncio.note;
                    s.phone = annuncio.tblDonne.phone;
                    s.whatsapp = annuncio.hasWhatapp;
                    s.telegram = annuncio.hasTelegram;
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
            if (ad.state != "CLOSE" && ad.state != "DELETE") {
                await ctx.tblSchedulazioni.update({ state: "ALERT" }, { where: { id: ad.id } });
            } else if (ad.state == "CLOSE") {
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
            } else {
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

async function postThis(ad, group, platform) {
    let remotePostID = null;
    let pubStatus = "OK";
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
                        await ad.update({ state: "OK" });
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
                    pagato = false;
                }

                try {
                    await ad.update({
                        state: pubStatus,
                        payed: pagato,
                        remotePostID: remotePostID,
                        urlBK: uriDateTimes.uri,
                        dateTimeTop: dateGetted
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
                await ad.update({ state: pubStatus, remotePostID: remotePostID });
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
                dateTimeTop: dateGetted
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

                    const updateResult = await platform.bot.update(ad, group, platform);
                    console.log(`${new Date()} Bakeca update result for schedule ${ad.id}:`, updateResult);
                    pubStatus = updateResult?.ok ? "OK" : "KO";
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

                    const deleteResult = await platform.bot.delete(ad.remotePostID, platform.platform);
                    console.log(`${new Date()} Bakeca delete result for schedule ${ad.id}:`, deleteResult);
                    pubStatus = deleteResult?.ok ? "DELETED" : "KO";
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

                    const suspendResult = await platform.bot.suspend(ad.remotePostID, ad, platform.platform);
                    console.log(`${new Date()} Bakeca suspend result for schedule ${ad.id}:`, suspendResult);
                    pubStatus = suspendResult?.ok ? "CLOSED" : "KO";
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

                    const rePublishResult = await platform.bot.republish(ad.remotePostID, ad, platform.platform);
                    console.log(`${new Date()} Bakeca republish result for schedule ${ad.id}:`, rePublishResult);
                    pubStatus = rePublishResult?.ok ? "OK" : "KO";
                    platform.needRefresh = true;
                    break;
                default:
                    const result = await platform.bot.publish(ad, group, platform)
                    console.log(result);
                    pubStatus = result?.ok ? "OK" : "KO";
                    ad.remotePostID = result?.payload?.idpriv || result?.megaId || null
                    ad.urlBK = result?.url || null;
                    ad.payed = Number(result?.creditsConsumed || 0) > 0;
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
                period: ad.period
            });
        } catch (bakecaActionError) {
            pubStatus = "KO";
            console.error(`Error in ${platform.platform} postThis state handling:`, bakecaActionError);
            logger.Write(`Publisher ERROR during ${platform.platform} operation: ${bakecaActionError.stack || bakecaActionError}`);
            if (ad.state == 'EDIT' || ad.state == 'CLOSE' || ad.state == 'DELETE') {
                await ad.update({
                    state: "KO",
                    remotePostID: ad.remotePostID
                });
            }
        }

        if (group.overBusyBot > 0) group.overBusyBot -= 1;
        console.log(`Final ${platform.platform} pubStatus:`, pubStatus);
    }
}

async function contactVerifyLoop(bot, cookies) {
    if (bot.refresh) {
        await bot.refresh();
    }

    let operations = await ctx.tblContactVerifyBakeca.findAll({ where: { action: { [Op.notLike]: "checked" } } });
    operations.forEach((operation) => {
        //console.log(`\nOperation "${operation.id}"`);
        const basicInfo = {
            contact: "+39" + operation.phone,
            city: cities[operation.city],
        }

        if (operation.action == "check" && !operation.status) {
            bot.sendRequest(
                {
                    ...basicInfo,
                    action: "check",
                },
                async (err, { statusCode }, body) => {
                    let success;
                    try {
                        success = JSON.parse(body).success === "OK";
                    } catch (err) {
                        success = statusCode === 204;
                    }
                    console.log(`Check completed. Approved: ${success}`);
                    if (success) {
                        operation.status = true;
                        operation.approved = true;
                        operation.action = "checked";
                        return updateOperation(operation);
                    }
                    //Qui aprire il browser per autentificare il numero di telefono
                    //Per fare ciò, dobbiamo simulare un nuovo post
                    operation.status = true;
                    console.log("Code sent.");
                    updateOperation(operation);
                    //await bot.checkPhone(basicInfo);

                    bot.sendRequest(
                        {
                            ...basicInfo,
                            action: "send_code",
                            captchaResponse: undefined
                        },
                        (err, res, body) => {
                            console.log({ res })
                            if (res.statusCode == 200) {
                                operation.status = true;
                                console.log("Code sent.")
                                updateOperation(operation);
                            }
                        },
                        cookies
                    );
                },
                cookies
            );
        } else if (operation.action === "code" && !operation.status) {
            bot.sendRequest(
                {
                    ...basicInfo,
                    action: "verify_code",
                    code: operation.code,
                },
                (err, { statusCode }, body) => {
                    console.error(err)
                    console.log({ statusCode, body })
                    let success;
                    try {
                        success = JSON.parse(body).success === "OK";
                    } catch (err) {
                        success = statusCode === 204;
                    }
                    console.log(success ? "Code approved." : "Code not approved.");
                    if (success) {
                        operation.approved = true;
                        operation.action = "checked";
                    }
                    operation.status = true;
                    updateOperation(operation);
                },
                cookies
            );
        };
    });
};

function startCheckPhoneBot() {
    if (botCheckPhone) {
        ensureSession(botCheckPhone, botCheckPhone.email).then((cookies) => {
            logger.Write(`Publisher say: Bot per la verifica del numero di telefono ha eseguito il login.`);
            checkPhoneMailLoop = setInterval(() => { contactVerifyLoop(botCheckPhone, cookies) }, 10000);
        }).catch(async function (err) {
            console.log(err);
            logger.Write(`Publisher ERROR: ${err}`);
            await closeBotBrowser(botCheckPhone, "check-phone login failure");
            setTimeout(() => {
                startCheckPhoneBot()
            }, 3000);
        });
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

CreateGroupsBot().then(async (groups) => {
    startPublisherApiServer();

    if (groups) {
        await startCheckPhoneBot();
        await startAllGroupLoops(groups);

        setInterval(() => {
            clearInterval(checkPhoneMailLoop);
            //botCheckPhone.browser.close();
            // restartGroups();
            setTimeout(() => {
                startCheckPhoneBot();
                // console.log("after startCheckBot in setTimeout")
            }, 100);
        }, (1000 * 60 * 120));
    }
});
