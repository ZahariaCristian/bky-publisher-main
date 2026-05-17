const crp = require("crypto");

const decryptPassword = (encryptPassword) => {
    var key = crp.scryptSync(process.env.TOKEN_SECRET, 'salt', 32);
    var iv = Buffer.alloc(16, 0); // Initialization vector
    var decipher = crp.createDecipheriv("aes-256-cbc", key, iv);
    var decrypted = decipher.update(Buffer.from(encryptPassword, 'hex'));
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString();
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const sleep = (seconds) => {
    const waitUntil = new Date().getTime() + seconds * 1000;
    while (new Date().getTime() < waitUntil) { };
}

const closeBotBrowser = async (bot, reason = "") => {
    if (!bot) return;
    if (!bot.browser || typeof bot.browser.close !== "function") {
        bot.page = null;
        return;
    }
    const browser = bot.browser;
    bot.browser = null;
    bot.page = null;
    try {
        await browser.close();
    } catch (err) {
        console.warn(`[!] Failed to close browser${reason ? ` (${reason})` : ""}:`, err?.message || err);
    }
}

const isTurnstileUnsolvableError = (err) => {
    if (!err) return false;
    const msg = typeof err.message === "string" ? err.message : "";
    const apiErr = typeof err.err === "string" ? err.err : "";
    return (
        apiErr.includes("ERROR_CAPTCHA_UNSOLVABLE") ||
        msg.includes("ERROR_CAPTCHA_UNSOLVABLE") ||
        msg.includes("captcha was unable to be solved")
    );
}

const updateOperation = (operation) => {
    operation.update({
        remoteID: operation.remoteID,
        action: operation.action,
        status: operation.status,
        approved: operation.approved,
        code: operation.code,
        phone: operation.phone,
        city: operation.city
    }).then(() => {
        return operation;
    });
};

module.exports = {
    decryptPassword,
    wait,
    sleep,
    isTurnstileUnsolvableError,
    updateOperation,
    closeBotBrowser
}