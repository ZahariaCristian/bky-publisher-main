const assert = require("node:assert/strict");
const { test } = require("node:test");
const puppeteer = require("puppeteer");
const { submitExistingAdUpdate } = require("../adsManage/moscarossa/publishAds");

async function updateResultPage(photoCount) {
    const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on("request", async (request) => {
        if (/moscarossa\.biz\/private\/vedi_annuncio_ut\.php/.test(request.url())) {
            await request.respond({
                status: 200,
                contentType: "text/html",
                body: `<html><body>ANGELICA ${photoCount} foto, 0 video
                  <a href="https://www.moscarossa.biz/girl-1159998.php">Clicca qui per vedere il tuo annuncio</a>
                </body></html>`
            });
        } else {
            await request.continue();
        }
    });
    await page.setContent(`<button class="buttonNext" onclick="location.href=
      'https://www.moscarossa.biz/private/vedi_annuncio_ut.php?id_accompa=1159998'">Continua</button>`);
    return { browser, page };
}

test("accepts the matching saved-ad page as completion of an existing ad update", async () => {
    const { browser, page } = await updateResultPage(3);
    try {
        const result = await submitExistingAdUpdate(page, "1159998", 3);
        assert.equal(result.remoteId, "1159998");
        assert.equal(result.imageCount, 3);
        assert.equal(result.publicUrl, "https://www.moscarossa.biz/girl-1159998.php");
        assert.match(result.url, /vedi_annuncio_ut\.php\?id_accompa=1159998/);
    } finally {
        await browser.close();
    }
});

test("does not confirm an update when the saved gallery count is different", async () => {
    const { browser, page } = await updateResultPage(2);
    try {
        await assert.rejects(
            submitExistingAdUpdate(page, "1159998", 3),
            /attese 3 foto, rilevate 2/
        );
    } finally {
        await browser.close();
    }
});
