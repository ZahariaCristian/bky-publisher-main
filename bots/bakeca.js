const puppeteer = require("puppeteer-extra");
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require("fs");
const path = require('path');
const { publishAd, log } = require('../adsManage/bakeca/publishAds');
const { updateAd } = require('../adsManage/bakeca/updateAds');
const { suspendAds, deleteAds, republishAds } = require('../adsManage/bakeca/suspendAds');
const { openPublishPage } = require('../adsManage/bakeca/uploadImages');
const RecaptchaPlugin = require("puppeteer-extra-plugin-recaptcha");
const TwoCaptcha = require("@2captcha/captcha-solver")
// const request = require("request");
// const { default: axios } = require("axios");
// const logger = require("../lib/logger");

const { RESIDENTIAL_PROXY } = require("../const");

const API_KEY = fs.readFileSync(__dirname + "/settings/2captchaApiKey.txt", "utf-8", function read(error, data) {
  if (err) {
    throw err;
  }
  var content = data;
  console.log(content);
});
const solver = new TwoCaptcha.Solver(API_KEY)

const LOGIN_URL = "https://www.bakeca.it/login/";
const PUBLISH_MASSAGGI_URL = "https://www.bakeca.it/inserisci/annuncio/sel_categoria/massaggi-benessere"
const PUBLISH_INCONTRI_URL = "https://www.bakeca.it/inserisci/annuncio/sel_categoria/incontri-amore"

const ANNOUNCEMENTS = "https://www.bakeca.it/miabakeca/annuncio/elencoutente/"
const CREDIT = "https://www.bakeca.it/miabakeca/crediti/acquista/";

const PUBLISH_URL = "https://www.bakeca.it/pubblica/annuncio/idPriv/";
const MODIFY_URL = "https://www.bakeca.it/modifica/annuncio/idpriv/";

const normalizeBakecaCategory = (category) => {
  const value = `${category || ""}`.toLowerCase();
  if (value.includes("massaggi") || value.includes("benessere")) return "massaggi-benessere";
  return "incontri-amore";
};

const normalizeBakecaContactType = (value) => {
  const normalized = `${value || ""}`.toLowerCase();
  if (normalized.includes("donnauomo") || normalized.includes("donna uomo") || normalized.includes("donna cerca uomo")) return "donna";
  if (normalized.includes("uomodonna") || normalized.includes("uomo donna") || normalized.includes("uomo cerca donna")) return "uomo";
  if (normalized.includes("uomouomo") || normalized.includes("uomo uomo") || normalized.includes("uomo cerca uomo")) return "uomo";
  if (normalized.includes("donnadonna") || normalized.includes("donna donna") || normalized.includes("donna cerca donna")) return "donna";
  if (normalized.includes("trans")) return "trans";
  if (normalized.includes("copp")) return "coppia";
  if (normalized.includes("uomo")) return "uomo";
  return "donna";
};

// puppeteer.use(StealthPlugin());
puppeteer.use(
  StealthPlugin(),
  RecaptchaPlugin({
    provider: {
      id: "2captcha",
      token: API_KEY,
    },
    visualFeedback: true,
    throwOnError: true
  })
);


class BakecaBot {
  constructor(email, password, credit, platform) {
    this.email = email;
    this.password = password;
    this.credit = credit;
    this.platform = platform;
    this.browser = null;
    this.page = null;
    this.token = null;
    this.remotePostID = null;
  };

  getCredential() {
    return {
      email: `${this.email || ""}`,
      password: `${this.password || ""}`
    };
  }

  async waitTillHTMLRendered(page, timeout = 30000) { //Function to wait for entire page and js loaded
    return new Promise(async (resolve, reject) => {
      try {
        const checkDurationMsecs = 1000;
        const maxChecks = timeout / checkDurationMsecs;
        let lastHTMLSize = 0;
        let checkCounts = 1;
        let countStableSizeIterations = 0;
        const minStableSizeIterations = 3;
        while (checkCounts++ <= maxChecks) {
          let html = await page.content();
          let currentHTMLSize = html.length;
          let bodyHTMLSize = await page.evaluate(() => document.body.innerHTML.length);
          if (lastHTMLSize != 0 && currentHTMLSize == lastHTMLSize)
            countStableSizeIterations++;
          else
            countStableSizeIterations = 0; //reset the counter
          if (countStableSizeIterations >= minStableSizeIterations) {
            resolve()
            break;
          }
          lastHTMLSize = currentHTMLSize;
          await new Promise((resolve) => setTimeout(resolve, checkDurationMsecs));
        }
      } catch (e) {
        resolve()
      }

    })
  };

  async restartBrowser(reason) {
    const note = reason ? ` (${reason})` : "";
    console.warn(`[!] Bakeca-Restarting bot browser${note}`);
    try {
      if (this.browser) {
        await this.browser.close();
      }
    } catch (e) {
      console.warn("Bakeca-Failed to close browser during restart:", e?.message || e);
    }
    this.browser = null;
    this.page = null;
    this.token = null;
  }

  async solveAndInjectTurnstile(page, solver) {
    try {
      // Step 1: Solve Turnstile via 2Captcha
      const solution = await solver.cloudflareTurnstile({
        pageurl: "https://www.bakeca.it/login/",
        sitekey: "0x4AAAAAABMyNd-c0BvRFF_d"
      });
      console.log('Turnstile token received:', solution);
      // Step 2: Wait for hidden input to appear
      await page.waitForSelector('input[name="cf-turnstile-response"]', {
        visible: false,
        timeout: 10000
      });

      // Step 3: Inject token into inputs with retries
      for (let i = 0; i < 2; i++) {
        const success = await page.evaluate((token) => {
          const turnstileInput = document.querySelector('input[name="cf-turnstile-response"]');
          const recaptchaInput = document.querySelector('input[name="g-recaptcha-response"]');
          let injected = false;
          if (turnstileInput) {
            turnstileInput.value = token;
            turnstileInput.setAttribute('value', token);
            turnstileInput.dispatchEvent(new Event('input', { bubbles: true }));
            turnstileInput.dispatchEvent(new Event('change', { bubbles: true }));
            injected = true;
          }
          if (recaptchaInput) {
            recaptchaInput.value = token;
            recaptchaInput.setAttribute('value', token);
            recaptchaInput.dispatchEvent(new Event('input', { bubbles: true }));
            recaptchaInput.dispatchEvent(new Event('change', { bubbles: true }));
            injected = true;
          }
          return injected;
        }, solution);
        if (success) {
          console.log('Token successfully injected');
          break;
        }
        console.warn('Injection failed, retrying...');
        await delay(1000);
      }
      // Step 4 (Optional): Submit the form manually if the site doesn't do it
      // Uncomment if needed
      try {
        await page.evaluate(() => {
          try {
            const form = document.querySelector('form');
            if (form) {
              form.submit();
              console.log('Form submitted successfully.');
            } else {
              console.warn('No form element found on the page.');
            }
          } catch (err) {
            console.error('Error during form submission inside page context:', err);
          }
        });
      } catch (outerErr) {
        console.error('Error evaluating form submission:', outerErr);
      }
    } catch (err) {
      console.error('Error solving/injecting Turnstile:', err);
      throw err;
    }
  }

  async login() {
    console.log('Bakeca-Login Bakeca');
    const creds = this.getCredential();
    const screenshotDir = path.join('./screenshots', creds.email);
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    try {
      console.log("Bakeca-");
      console.log(1, puppeteer.executablePath(), RESIDENTIAL_PROXY, "Launching browser...");

      if (!this.browser) {
        this.browser = await puppeteer.launch({
          headless: false,
          executablePath: puppeteer.executablePath(),
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            "--disable-blink-features=AutomationControlled",
            "--disable-dev-shm-usage",
            // "--disable-infobars",
            // "--disable-web-security",
            // "--disable-features=IsolateOrigins,site-per-process",
            // '--window-size=1920,1080',
            `--proxy-server=http://${RESIDENTIAL_PROXY.host}:${RESIDENTIAL_PROXY.port}`
          ],
          defaultViewport: null,
        });
      }

      this.page = await this.browser.newPage();

      await this.page.screenshot({ path: `${screenshotDir}/LoginBakeca1.png`, fullPage: true });
      // proxy auth
      await this.page.authenticate({
        username: RESIDENTIAL_PROXY.username,
        password: RESIDENTIAL_PROXY.password
      });

      await this.page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
      );
      // await page.setViewport({ width: 1366, height: 768 });
      // await takeShot(this.page, "start");

      // ===== TARGET =====
      console.log(2, "Bakeca-Opening target...");
      await this.page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
      await this.page.screenshot({ path: `${screenshotDir}/LoginBakeca2.png`, fullPage: true });

      // ===== CLOUDFLARE =====
      console.log(3, "Bakeca-Waiting Cloudflare...");
      await this.page.waitForFunction(() => {
        return !document.body.innerText.includes('Enable JavaScript') &&
          !document.body.innerText.includes('Verifying you are human');
      }, { timeout: 30000 }).catch(() => {
        console.log(3, "Bakeca-Cloudflare timeout");
      });
      // await new Promise(r => setTimeout(r, 2000));
      await this.page.screenshot({ path: `${screenshotDir}/LoginBakeca3.png`, fullPage: true });

      // ===== WAIT Email Input =====
      console.log(4, "Bakeca-Waiting Email Input...");
      const hasEmailInput = await this.page.waitForFunction(() => {
        return document.querySelectorAll('#email').length > 0;
      }, { timeout: 20000 })

      console.log(5, "Bakeca-Waiting Password Input...");
      const hasPasswordInput = await this.page.waitForFunction(() => {
        return document.querySelectorAll('#password').length > 0;
      }, { timeout: 20000 })

      console.log(6, "Bakeca-Waiting Submit Button...");
      const hasSubmitButton = await this.page.waitForFunction(() => {
        return document.querySelectorAll('#entra').length > 0;
      }, { timeout: 20000 })
      // await this.page.screenshot({ path: `${screenshotDir}/LoginBakeca4.png`, fullPage: true });

      // ===== FULL RENDER =====
      // log(7, "Waiting render...");
      await this.waitTillHTMLRendered(this.page);
      await this.page.screenshot({ path: `${screenshotDir}/LoginBakeca4.png`, fullPage: true });

      console.log(`[i] Bakeca-Login password for "${creds.email}": "${creds.password}"`);

      // ===== TYPE EMAIL =====
      await this.fillInputWithRetry('#email', creds.email);
      // ===== TYPE PASSWORD =====
      await this.fillInputWithRetry('#password', creds.password);

      await this.page.waitForFunction(({ email, password }) => {
        const emailInput = document.querySelector('#email');
        const passwordInput = document.querySelector('#password');
        return Boolean(emailInput && passwordInput)
          && emailInput.value === email
          && passwordInput.value === password;
      }, {
        timeout: 5000
      }, {
        email: creds.email,
        password: creds.password
      });
      // ===== CLICK LOGIN =====
      await this.page.click('#entra');
      await this.page.screenshot({ path: `${screenshotDir}/LoginBakeca5.png`, fullPage: true });

      // ===== WAIT NAVIGATION =====
      await this.page.waitForNavigation({
        waitUntil: 'networkidle2',
        timeout: 30000
      }).catch(() => { });
      // ===== CHECK LOGIN SUCCESS =====
      const isLogged = await this.page.evaluate(() => {
        return !document.querySelector('.bk-miaBakecaAnnunciForm'); // login form disappears
      });
      await this.page.screenshot({ path: `${screenshotDir}/LoginBakeca6.png`, fullPage: true });

      const cookies = await this.page.cookies();
      // console.log(cookies, "cookies");
      console.log("[i] Bakeca-Login success as: ", creds.email);
      // return { browser, page };
      return JSON.stringify(cookies);
    } catch (err) {
      // screenNum = 1;
      console.error("❌ Bakeca-ERROR:", err.message);
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
        this.page = null;
        this.token = null;
      }
      await this.delay(3000);
    }
  }

  /**
   * Type text reliably:
   * - wait for selector visible
   * - focus, select-all, clear existing value
   * - type with per-char delay
   * - verify the value matches
   */
  //Refresh in Main Loop
  async refresh2() {
    console.log('Bakeca- refresh2')
    const creds = this.getCredential();
    const screenshotDir = path.join('./screenshots', creds.email);
    try {
      if (!this.page || this.page.isClosed()) {
        return { error: "Page not available" };
      }

      await this.page.goto(CREDIT, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await this.waitTillHTMLRendered(this.page);
      // ===== WAIT NAVIGATION =====
      await this.page.waitForNavigation({
        waitUntil: 'networkidle2',
        timeout: 30000
      }).catch(() => { });
      // await this.page.waitForFunction(() => {
      //   return document.querySelector('.b-percent-title"]');
      // }, { timeout: 30000 });

      await this.page.screenshot({ path: `${screenshotDir}/bakeca_refresh1.png`, fullPage: true });

      let credit = null;
      try {
        // await this.page.waitForSelector(CREDIT_SELECTOR, { timeout: 5000 });
        // credit = await this.page.$eval(CREDIT_SELECTOR, el => el.textContent.trim());
        credit = await this.page.$eval('.b-percent-title', el =>
          parseInt(el.innerText)
        );
      } catch (e) {
        console.warn("[!] Bakeca-Primary credit selector failed (refresh2), fallback parsing.");
        // try {
        //   const liSelector = 'ul.list-group li.list-group-item';
        //   await this.page.waitForSelector(liSelector, { timeout: 4000 });
        //   const items = await this.page.$$(liSelector);
        //   for (const item of items) {
        //     const text = await this.page.evaluate(el => el.textContent, item);
        //     if (text.includes('ATTUALI')) {
        //       credit = await this.page.evaluate(el => {
        //         const badge = el.querySelector('span.badge, span');
        //         return badge ? badge.textContent.trim() : null;
        //       }, item);
        //       break;
        //     }
        //   }
        // } catch { }
      }

      if (!credit) {
        console.error("[!] Bakeca-Credit not found (refresh2).");
        return { error: "Credit not found" };
      }

      this.credit = credit;
      console.log("[✓] Bakeca-Credit found:refresh", this.credit);

      // this.coupon = await this.page.$$eval(
      //   'div.coupon.rounded-lg.flex-column.h-100.coupon-border.p-3',
      //   els => els.length > 0 ? 1 : 0
      // ).catch(() => 0);

      let cookies = await this.page.cookies();
      if (!cookies || cookies.length === 0) {
        await this.delay(1000);
        cookies = await this.page.cookies();
      }
      if (!cookies || cookies.length === 0) return { error: "Cookies not available" };
      return [this.credit, JSON.stringify(cookies), 0];
    } catch (error) {
      console.error("Bakeca-Error in refresh2:", error.message);
      return { error: error.message };
    }
  }

  async delay(time) {
    return new Promise(function (resolve) {
      setTimeout(resolve, time)
    });
  }

  async fillInputWithRetry(selector, value, options = {}) {
    const maxAttempts = options.maxAttempts || 3;
    const typingDelay = options.typingDelay || 50;

    await this.page.waitForSelector(selector, {
      visible: options.visible !== false,
      timeout: options.timeout || 20000
    });

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await this.page.click(selector, { clickCount: 3 });
      } catch { }

      try {
        await this.page.keyboard.press('Backspace');
      } catch { }

      await this.page.evaluate((targetSelector) => {
        const input = document.querySelector(targetSelector);
        if (!input) {
          return;
        }

        input.focus();
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }, selector);

      try {
        await this.page.type(selector, value, { delay: typingDelay });
      } catch { }

      let currentValue = await this.page.$eval(selector, (node) => node.value || '').catch(() => '');
      if (currentValue === value) {
        return true;
      }

      await this.page.evaluate(({ targetSelector, targetValue }) => {
        const input = document.querySelector(targetSelector);
        if (!input) {
          return;
        }

        const prototype = Object.getPrototypeOf(input);
        const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value')
          || Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

        if (descriptor?.set) {
          descriptor.set.call(input, targetValue);
        } else {
          input.value = targetValue;
        }

        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('blur', { bubbles: true }));
      }, {
        targetSelector: selector,
        targetValue: value
      });

      currentValue = await this.page.$eval(selector, (node) => node.value || '').catch(() => '');
      if (currentValue === value) {
        return true;
      }

      console.warn(`[!] Bakeca-Fill retry for ${selector}, attempt ${attempt}/${maxAttempts}`);
      await this.delay(300);
    }

    throw new Error(`Unable to fill input ${selector}`);
  }

  async publish(ad, group, platform) {
    const bakecaCategory = normalizeBakecaCategory(ad.categorie);
    let publishUrl = bakecaCategory === "massaggi-benessere" ? PUBLISH_MASSAGGI_URL : PUBLISH_INCONTRI_URL;

    await openPublishPage(this.page, publishUrl)
    // console.log(ad.promo, ad.sono, 'ad promo')

    let publishData = {
      titolo: ad?.title || '',
      testo: ad.description || '',
      email: ad.username,
      cercoamoreincontri: normalizeBakecaContactType(ad.sono || ad.categorie),
      contattotelefonico: ad.phone,
      tiporeply: "4",
      comune: ad.annunci_city,
      sel_provincia: "roma",
      sel_comune: "058091",
      categoria: bakecaCategory,
      sezione: "cita",
      images: ad.pics,
      typeAnnuncio: ad.promo.visibility,
      period: ad.promo.schedule
      // imageFolder: "./images",
      // imageLimit: 20
    }

    const result = await publishAd(this.page, publishData);

    // log("result", "Publish flow result", result);
    // console.log(JSON.stringify(result, null, 2));
    return result;
  }

  async update(ad, group, platform) {
    const remoteId = ad.remotePostID || await this.resolveRemoteId(ad);
    if (!remoteId) {
      throw new Error(`Bakeca remotePostID missing for EDIT state on schedule ${ad.id}`);
    }

    ad.remotePostID = remoteId;
    await openPublishPage(this.page, `${MODIFY_URL}${remoteId}`);
    await this.waitTillHTMLRendered(this.page).catch(() => { });
    await this.delay(1000);

    const bakecaCategory = normalizeBakecaCategory(ad.categorie);
    let publishData = {
      titolo: ad?.title || '',
      testo: ad.description || '',
      email: ad.username,
      cercoamoreincontri: normalizeBakecaContactType(ad.sono || ad.categorie),
      contattotelefonico: ad.phone,
      tiporeply: "4",
      comune: ad.annunci_city,
      sel_provincia: "roma",
      sel_comune: "058091",
      categoria: bakecaCategory,
      sezione: "cita",
      images: ad.pics
    }

    const result = await updateAd(this.page, publishData);

    // log("result", "Update flow result", result);
    // console.log(JSON.stringify(result, null, 2));
    return result;
  }

  async resolveRemoteId(ad) {
    const normalizedTitle = (ad?.title || "").trim().toLowerCase();
    const normalizedCity = (ad?.city || "").trim().toLowerCase();

    await this.page.goto(ANNOUNCEMENTS, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await this.waitTillHTMLRendered(this.page).catch(() => { });

    return this.page.evaluate(({ title, city }) => {
      const normalize = (value) => String(value || "").trim().toLowerCase();
      const extractIdPriv = (value) => {
        const match = String(value || "").match(/idpriv\/([a-f0-9]{32})/i);
        return match ? match[1] : "";
      };

      const cards = Array.from(document.querySelectorAll('.b-rw.b-ann-mb-item, .b-ann-mb-item'));
      const matches = cards.map((card) => {
        const cardTitle = normalize(
          card.querySelector('.b-ann-title')?.textContent
          || card.querySelector('h3')?.textContent
          || ""
        );
        const cardCity = normalize(card.querySelector('.b-ann-meta')?.textContent || "");

        const actionRoot = card.querySelector('[id^="annuncio_"]') || card;
        const containerId = actionRoot?.id || "";
        const containerIdPriv = containerId.startsWith("annuncio_")
          ? containerId.replace(/^annuncio_/i, "")
          : "";

        const deleteAction = card.querySelector('.b-delete-annuncio');
        const dataHrefId = extractIdPriv(deleteAction?.getAttribute('data-href'));
        const dataIdPriv = deleteAction?.getAttribute('data-idpriv') || "";
        const linkedId = Array.from(card.querySelectorAll('a'))
          .map((link) => extractIdPriv(link.getAttribute('href')))
          .find(Boolean) || "";

        return {
          idPriv: containerIdPriv || dataIdPriv || dataHrefId || linkedId,
          titleMatch: title ? cardTitle === title : false,
          cityMatch: city ? cardCity === city : false
        };
      }).filter((item) => item.idPriv);

      const exactMatch = matches.find((item) => item.titleMatch && item.cityMatch);
      if (exactMatch) {
        return exactMatch.idPriv;
      }

      const titleOnlyMatch = matches.find((item) => item.titleMatch);
      if (titleOnlyMatch) {
        return titleOnlyMatch.idPriv;
      }

      const cityOnlyMatch = matches.find((item) => item.cityMatch);
      if (cityOnlyMatch) {
        return cityOnlyMatch.idPriv;
      }

      return "";
    }, {
      title: normalizedTitle,
      city: normalizedCity
    });
  }

  async republish(remoteId){
    return republishAds(this.page, remoteId)
  }

  async suspend(remoteId) {
    return suspendAds(this.page, remoteId);
  }

  async delete(remoteId) {
    return deleteAds(this.page, remoteId);
  }
};

module.exports = BakecaBot;
