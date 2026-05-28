const puppeteer = require("puppeteer-extra");
const RecaptchaPlugin = require("puppeteer-extra-plugin-recaptcha");
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const request = require("request");
const fs = require("fs");
const { default: axios } = require("axios");
const path = require('path');
const TwoCaptcha = require("@2captcha/captcha-solver")
const logger = require("../lib/logger");

const API_KEY = fs.readFileSync(__dirname + "/settings/2captchaApiKey.txt", "utf-8", function read(error, data) {
  if (err) {
    throw err;
  }
  var content = data;
  console.log(content);
});
const solver = new TwoCaptcha.Solver(API_KEY);

const LOGIN_URL = "https://www.bakecaincontrii.com/u/login/";
const PUBLISH_URL = "https://bakecaincontrii.com/u/post-insert/";
const MANAGE_POST = "https://bakecaincontrii.com/u/post-manage/";
const PURCHASE_SUM = "https://bakecaincontrii.com/u/purchase-summary/";
const PAGE_DASHBOARD = "https://www.bakecaincontrii.com/u/account/dashboard/";
const CREDIT_SELECTOR = "#app > main > div > div.row > div.col-md-7.order-md-0 > div:nth-child(1) > div:nth-child(2) > div > div > div > div > div > ul > li:nth-child(1) > span.badge";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

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

class BakecaincontriiBot {
  constructor(email, password) {
    this.email = email;
    this.password = password;
    this.browser = null;
    this.platform = null; //Add by Zaharia
    this.page = null;
    this.token = null;
    this.credit = null;
    this.remotePostID = null;
  };

  getLoginCredentialsSnapshot() {
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
          await delay(checkDurationMsecs);
        }
      } catch (e) {
        resolve()
      }

    })
  };

  isTurnstileSolverServerError(err) {
    if (!err) return false;
    const msg = typeof err.message === "string" ? err.message : "";
    const apiErr = typeof err.err === "string" ? err.err : "";
    return (
      apiErr.includes("500 Internal Server Error") ||
      msg.includes("500 Internal Server Error") ||
      msg.includes("An Unexpected Error has occured") ||
      apiErr.includes("ERROR_BAD_PROXY")
    );
  }

  async restartBrowser(reason) {
    const note = reason ? ` (${reason})` : "";
    console.warn(`[!] Restarting bot browser${note}`);
    try {
      if (this.browser) {
        await this.browser.close();
      }
    } catch (e) {
      console.warn("Failed to close browser during restart:", e?.message || e);
    }
    this.browser = null;
    this.page = null;
    this.token = null;
  }

  async configureLoginPage(page) {
    await page.setUserAgent(USER_AGENT);
    await page.setExtraHTTPHeaders({
      "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7"
    });
    await page.setViewport({
      width: 1365 + Math.floor(Math.random() * 80),
      height: 768 + Math.floor(Math.random() * 80),
      deviceScaleFactor: 1
    });
  }

  async getCloudflareBlockInfo(page) {
    return page.evaluate(() => {
      const text = document.body?.innerText || "";
      const blocked =
        /sorry,\s*you have been blocked/i.test(text) ||
        /you are unable to access/i.test(text) ||
        /cloudflare ray id/i.test(text);

      if (!blocked) return null;

      const rayMatch = text.match(/Cloudflare Ray ID:\s*([a-z0-9]+)/i);
      return {
        rayId: rayMatch ? rayMatch[1] : null,
        title: document.title || "",
        url: location.href
      };
    }).catch(() => null);
  }

  async assertNotCloudflareBlocked(page, label = "login page") {
    const blockInfo = await this.getCloudflareBlockInfo(page);
    if (!blockInfo) return;

    const ray = blockInfo.rayId ? `, ray=${blockInfo.rayId}` : "";
    throw new Error(`Bakecaincontrii Cloudflare block on ${label} (url=${blockInfo.url}${ray})`);
  }

  async getLoginSelectors(page) {
    return page.evaluate(() => {
      const isVisible = (node) => {
        if (!node) return false;
        const style = window.getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      };

      const cssPath = (node) => {
        if (node.id) return `#${CSS.escape(node.id)}`;
        const name = node.getAttribute("name");
        if (name) return `${node.tagName.toLowerCase()}[name="${CSS.escape(name)}"]`;
        const type = node.getAttribute("type");
        if (type) return `${node.tagName.toLowerCase()}[type="${CSS.escape(type)}"]`;
        return node.tagName.toLowerCase();
      };

      const inputs = Array.from(document.querySelectorAll("input")).filter(isVisible);
      const emailInput =
        inputs.find((input) => input.type === "email") ||
        inputs.find((input) => /email|mail|username|login|user/i.test(`${input.name} ${input.id} ${input.placeholder}`));
      const passwordInput =
        inputs.find((input) => input.type === "password") ||
        inputs.find((input) => /password|pass/i.test(`${input.name} ${input.id} ${input.placeholder}`));

      return {
        email: emailInput ? cssPath(emailInput) : "input[name='email'], input[type='email']",
        password: passwordInput ? cssPath(passwordInput) : "input[name='password'], input[type='password']"
      };
    });
  }

  async waitForLoginFormReady(page) {
    await page.waitForFunction(() => document.readyState === "complete", { timeout: 30000 }).catch(() => { });
    await this.waitTillHTMLRendered(page);
    await this.assertNotCloudflareBlocked(page);

    const selectors = await this.getLoginSelectors(page);

    for (const selector of [selectors.email, selectors.password]) {
      await page.waitForSelector(selector, { visible: true });
      await page.waitForFunction(
        (sel) => {
          const input = document.querySelector(sel);
          if (!input) return false;
          const style = window.getComputedStyle(input);
          return !input.disabled && !input.readOnly && style.display !== "none" && style.visibility !== "hidden";
        },
        { timeout: 10000 },
        selector
      );
    }

    return selectors;
  }

  async solveAndInjectTurnstile(page, solver) {
    try {
      // Step 1: Solve Turnstile via 2Captcha
      const solution = await solver.cloudflareTurnstile({
        pageurl: "https://www.bakecaincontrii.com/u/login/",
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

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async login({ turnstileRetry = 0 } = {}) {
    console.log("Bakecaincontrii Login");
    const creds = this.getLoginCredentialsSnapshot();
    const screenshotDir = path.join('./screenshots', creds.email);
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        executablePath: puppeteer.executablePath(),
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-infobars',
          '--window-size=1365,768',
        ],
        defaultViewport: null,
      });
    }

    // const context = await this.browser.createIncognitoBrowserContext();
    // this.page = await context.newPage();

    this.page = await this.browser.newPage();
    await this.configureLoginPage(this.page);

    // Useful defaults
    this.page.setDefaultTimeout(20000);
    this.page.setDefaultNavigationTimeout(30000);

    await this.page.goto(LOGIN_URL, { waitUntil: 'networkidle2' });
    // await this.delay(500 + Math.random() * 800);
    await this.delay(500 + Math.random() * 800);
    await this.page.screenshot({ path: `${screenshotDir}/loginBUG1.png`, fullPage: true });
    await this.assertNotCloudflareBlocked(this.page, "initial login load");

    // Close any visible modals
    const modals = await this.page.$$('.modal.show, .modal.fade.show');
    for (let i = 0; i < modals.length; i++) {
      try {
        const closeBtn = await modals[i].$('button.close, .modal-header button[data-dismiss="modal"], [data-bs-dismiss="modal"]');
        if (closeBtn) {
          await closeBtn.click();
          await this.delay(200);
        }
      } catch (e) {
        console.warn(`Failed to close modal ${i + 1}:`, e.message);
      }
      await this.delay(400 + Math.random() * 700);
      await this.page.screenshot({ path: `${screenshotDir}/loginBUG${i + 2}.png`, fullPage: true });
    }
    const selectors = await this.waitForLoginFormReady(this.page);

    // Robust typing
    await this.typeHuman(this.page, selectors.email, creds.email);
    await this.page.screenshot({ path: `${screenshotDir}/loginBUG4.png`, fullPage: true });
    await this.typeHuman(this.page, selectors.password, creds.password, { secure: true });
    console.log(`[i] Login password for "${creds.email}": "${creds.password}"`);
    await this.page.screenshot({ path: `${screenshotDir}/loginBUG5.png`, fullPage: true });

    // Solve CAPTCHA (leaving your function call as-is)
    try {
      await this.solveAndInjectTurnstile(this.page, solver);
    } catch (err) {
      const maxTurnstileRetries = 1;
      const retryCount = turnstileRetry;
      if (this.isTurnstileSolverServerError(err) && retryCount < maxTurnstileRetries) {
        console.warn("[!] Turnstile solver 500 error, restarting bot and retrying login.");
        await this.restartBrowser("turnstile solver 500");
        await this.delay(3000);
        return this.login({ turnstileRetry: retryCount + 1 });
      }
      throw err;
    }

    await this.delay(800 + Math.random() * 1200);
    await this.page.screenshot({ path: `${screenshotDir}/loginBUG6.png`, fullPage: true });

    // Submit via button + wait for navigation
    try {
      const submitSel = "button[type='submit'], input[type='submit'], form button:not([type]), form [type='submit']";
      await this.page.waitForSelector(submitSel, { visible: true });
      const submitBtn = await this.page.$(submitSel);

      await Promise.all([
        this.page.waitForNavigation({ waitUntil: 'networkidle2' }),
        submitBtn.click()
      ]);
    } catch (e) {
      console.warn("Submit via button failed, trying Enter:", e.message);
      // Fallback: press Enter in password field
      const pwdHandle = await this.page.$(selectors.password);
      if (pwdHandle) {
        await pwdHandle.press('Enter');
        await this.page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => { });
      }
    }

    await this.delay(1000);
    await this.page.screenshot({ path: `${screenshotDir}/loginBUG7.png`, fullPage: true });

    // Ensure we are authenticated before returning cookies.
    await this.page.goto(PAGE_DASHBOARD, { waitUntil: 'networkidle2' }).catch(() => { });
    await this.waitTillHTMLRendered(this.page);

    const cookies = await this.page.cookies();
    const csrftoken = cookies.find(c => c.name === "csrftoken")?.value || null;
    const fSessionId = cookies.find(c => c.name === "f_session_id")?.value || null;
    const loggedCookie = cookies.find(c => c.name === "logged_cookie")?.value || null;
    const onLoginPage = this.page.url().includes("/u/login");

    if (onLoginPage || !csrftoken || !fSessionId || !loggedCookie) {
      throw new Error(
        `Login cookie validation failed for ${creds.email} (url=${this.page.url()}, csrftoken=${Boolean(csrftoken)}, f_session_id=${Boolean(fSessionId)}, logged_cookie=${Boolean(loggedCookie)})`
      );
    }

    this.token = csrftoken;

    console.log(`[i] Login success in Bakecaincontrii as: "${creds.email}"`);
    console.log(`[i] Token: "${this.token}"`);

    await this.waitTillHTMLRendered(this.page);
    await this.page.screenshot({ path: `${screenshotDir}/loginBUG8.png`, fullPage: true });

    return JSON.stringify(cookies);
  }

  async initWithCookies(cookiesJson) {
    if (!cookiesJson) return false;

    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        executablePath: puppeteer.executablePath(),
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          // '--disable-blink-features=AutomationControlled',
          // '--disable-dev-shm-usage',
          // '--disable-infobars',
          // '--disable-web-security',
          // '--disable-features=IsolateOrigins,site-per-process',
          // '--window-size=1920,1080',
        ],
        defaultViewport: null,
      });
    }

    let cookies;
    try {
      cookies = JSON.parse(cookiesJson);
    } catch (e) {
      console.error("Invalid cookie JSON, cannot reuse session.");
      return false;
    }

    const hasLoggedCookie = cookies.some((c) => c && c.name === "logged_cookie" && c.value);
    const hasSessionCookie = cookies.some((c) => c && c.name === "f_session_id" && c.value);
    if (!hasLoggedCookie || !hasSessionCookie) {
      console.warn("[!] Session reuse skipped: missing logged_cookie or f_session_id.");
      return false;
    }

    // const context = await this.browser.createIncognitoBrowserContext();
    // this.page = await context.newPage();
    this.page = await this.browser.newPage();

    this.page.setDefaultTimeout(20000);
    this.page.setDefaultNavigationTimeout(30000);

    try {
      await this.page.goto("https://www.bakecaincontrii.com/", { waitUntil: 'domcontentloaded' });
      await this.page.setCookie(...cookies);
      this.token = cookies.find(c => c.name === "csrftoken")?.value || null;

      await this.page.goto(PAGE_DASHBOARD, { waitUntil: 'networkidle2' });
      await this.waitTillHTMLRendered(this.page);

      if (this.page.url().includes("/u/login")) {
        console.warn("[!] Session reuse failed, redirected to login.");
        return false;
      }
      return true;
    } catch (e) {
      console.error("Session reuse failed:", e.message);
      return false;
    }
  }

  /**
   * Type text reliably:
   * - wait for selector visible
   * - focus, select-all, clear existing value
   * - type with per-char delay
   * - verify the value matches
   */
  async typeHuman(page, selector, text, { secure = false, debug = false } = {}) {
    await page.waitForSelector(selector, { visible: true });
    await page.waitForFunction(
      (sel) => {
        const input = document.querySelector(sel);
        if (!input) return false;
        const style = window.getComputedStyle(input);
        return !input.disabled && !input.readOnly && style.display !== 'none' && style.visibility !== 'hidden';
      },
      { timeout: 10000 },
      selector
    );

    const el = await page.$(selector);
    // Make sure it’s interactable
    await el.evaluate((node) => {
      node.scrollIntoView({ block: 'center', inline: 'nearest' });
    });

    // Focus and clear
    await el.click({ clickCount: 3, delay: 50 }); // select-all
    await page.waitForFunction(
      (sel) => document.activeElement === document.querySelector(sel),
      { timeout: 5000 },
      selector
    ).catch(async () => {
      await page.focus(selector);
      await page.waitForFunction(
        (sel) => document.activeElement === document.querySelector(sel),
        { timeout: 5000 },
        selector
      );
    });
    await page.keyboard.press('Backspace');

    // As extra safety, set value empty through JS (covers masked inputs)
    await page.evaluate((sel) => {
      const input = document.querySelector(sel);
      if (!input) return;
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, selector);

    // Type with delay
    const delay = 60 + Math.floor(Math.random() * 70); // 60–130ms/char
    await el.type(text, { delay });

    // Verify typed value
    await page.waitForFunction(
      (sel, val) => {
        const input = document.querySelector(sel);
        return input && input.value === val;
      },
      {},
      selector,
      text
    );

    // Optional: small pause after typing (helps with React/Angular)
    await this.delay(120 + Math.random() * 180);

    // Debug (don’t log secrets)
    if (!secure && debug) {
      console.log(`Typed into ${selector}: "${text}"`);
    }
  }

  async repeatLogin() {
    const creds = this.getLoginCredentialsSnapshot();
    var loggedGroup = false;
    setTimeout(() => {
      if (loggedGroup == false) return new Error("Login timeout");
    }, 1000 * 120);

    await this.configureLoginPage(this.page);
    await this.page.goto(LOGIN_URL);
    await this.delay(Math.random() * 1000 + 1000);
    // Accepting age
    await this.page.screenshot({
      path: './screenshots/repeat-loginBUG1.png', fullPage: true
    });
    try {
      await this.page.click("#exampleModalCenter > div > div > div > button")
    } catch (e) {
    }
    await this.delay(Math.random() * 1000 + 1000);
    await this.page.screenshot({
      path: './screenshots/repeat-loginBUG2.png', fullPage: true
    });
    // Input credentials
    try {
      await this.page.click("#exampleModalCenter > div > div > div > button")
    } catch (e) {
    }
    const selectors = await this.waitForLoginFormReady(this.page);
    await this.typeHuman(this.page, selectors.email, creds.email);
    try {
      await this.page.click("#exampleModalCenter > div > div > div > button")
    } catch (e) {
    }
    await this.page.screenshot({
      path: './screenshots/repeat-loginBUG3.png', fullPage: true
    });
    await this.typeHuman(this.page, selectors.password, creds.password, { secure: true });
    console.log(`[i] Login password for "${creds.email}": "${creds.password} in repeat"`);
    try {
      await this.page.click("#exampleModalCenter > div > div > div > button")
    } catch (e) {
    }
    await this.page.screenshot({
      path: './screenshots/repeat-loginBUG4.png', fullPage: true
    });
    // Enter captcha
    await this.page.solveRecaptchas();
    await this.page.screenshot({
      path: './screenshots/repeat-loginBUG5.png', fullPage: true
    });
    // Submitting login
    await this.delay(Math.random() * 1000 + 2000);
    await this.page.screenshot({
      path: './screenshots/repeat-loginBUG6.png', fullPage: true
    });
    await this.page.click("button[type='submit']");
    await this.page.screenshot({
      path: './screenshots/repeat-loginBUG7.png', fullPage: true
    });
    loggedGroup = true;
    await this.delay(3000);
    await this.page.screenshot({
      path: './screenshots/repeat-loginBUG8.png', fullPage: true
    });
    const cookies = await this.page.cookies();
    this.token = cookies.filter(c => c.name === "csrftoken")[0].value
    console.log(`Successfully logged in with token:\n"${this.token}"\n\n`);
    await this.page.screenshot({
      path: './screenshots/repeat-loginBUG9.png', fullPage: true
    });

    await this.delay(Math.random() * 1000 + 1000);
    await this.waitTillHTMLRendered(this.page)

    return JSON.stringify(cookies);
    //this.credit = await this.page.evaluate(el => el.textContent, element);
    //return this.credit;
  };

  async refresh() {//Get Credit and Cookie Dashboard at least 3 times attempts 
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        if (!this.page || this.page.isClosed()) {
          return { error: "Page not available" };
        }

        await this.page.goto(PAGE_DASHBOARD, { waitUntil: 'networkidle2', timeout: 30000 });
        await this.waitTillHTMLRendered(this.page);
        await this.page.screenshot({ path: "./screenshots/testrefresh2.png", fullPage: true });

        // --- Close all open modals, including ones with class "modal fade show"
        const modals = await this.page.$$('.modal.show, .modal.fade.show');
        for (let i = 0; i < modals.length; i++) {
          try {
            const closeBtn = await modals[i].$('button.close, .modal-header button[data-dismiss="modal"]');
            if (closeBtn) {
              await closeBtn.click();
              console.log(`Modal ${i + 1} closed.`);
            } else {
              console.warn(`No close button found in modal ${i + 1}`);
            }
          } catch (e) {
            console.warn(`Failed to close modal ${i + 1}:`, e.message);
          }

          await this.delay(Math.random() * 1000 + 1000);
          await this.page.screenshot({ path: `./screenshots/loginBUG${i + 2}.png`, fullPage: true });
        }

        // --- Extract credits from list where text contains "ATTUALI"
        const liSelector = 'ul.list-group li.list-group-item';
        await this.page.waitForSelector(liSelector, { timeout: 5000 }).catch(() =>
          console.log(`[!] Errored on credits selector for ${this.email}`)
        );

        let credit = null;
        try {
          await this.page.waitForSelector(CREDIT_SELECTOR, { timeout: 5000 });
          credit = await this.page.$eval(CREDIT_SELECTOR, el => el.textContent.trim());
        } catch (e) {
          console.warn("[!] Primary credit selector failed, fallback to legacy parsing.");
          try {
            await this.page.waitForSelector(liSelector, { timeout: 4000 });
            credit = await this.page.$$eval(liSelector, (items) => {
              for (const item of items) {
                const text = item.textContent || "";
                if (text.includes('ATTUALI')) {
                  const badge = item.querySelector('span.badge, span');
                  return badge ? badge.textContent.trim() : null;
                }
              }
              return null;
            });
          } catch { }
        }

        if (!credit) {
          console.error("[!] Credit not found.");
          return { error: "Credit not found" };
        }

        this.credit = credit;
        console.log("[✓] Credit Bakecaincontrii found:refresh", this.credit);

        // --- Cookie logic
        let cookies = await this.page.cookies();
        if (!cookies || cookies.length === 0) {
          console.warn("[!] No cookies found, retrying...");
          await this.delay(1000);
          cookies = await this.page.cookies();
        }

        if (!cookies || cookies.length === 0) {
          console.error("[!] Cookies still not found after retry.");
          return { error: "Cookies not available" };
        }

        return [this.credit, JSON.stringify(cookies)];
      } catch (error) {
        const msg = error && error.message ? error.message : String(error);
        if (msg.includes("Execution context was destroyed") && attempt < maxAttempts) {
          console.warn(`[!] refresh retry ${attempt}/${maxAttempts - 1} after navigation.`);
          await this.delay(800);
          continue;
        }
        console.error("Error in refresh:", msg);
        return { error: msg };
      }
    }
  }

  async refresh2() {//Get Credit, Cookie and Coupon from Dashboard
    try {
      if (!this.page || this.page.isClosed()) {
        return { error: "Page not available" };
      }

      await this.page.goto(PAGE_DASHBOARD, { waitUntil: 'networkidle2', timeout: 30000 });
      await this.waitTillHTMLRendered(this.page);
      await this.page.screenshot({ path: "./screenshots/testrefresh2.png", fullPage: true });

      let credit = null;
      try {
        await this.page.waitForSelector(CREDIT_SELECTOR, { timeout: 5000 });
        credit = await this.page.$eval(CREDIT_SELECTOR, el => el.textContent.trim());
      } catch (e) {
        console.warn("[!] Primary credit selector failed (refresh2), fallback parsing.");
        try {
          const liSelector = 'ul.list-group li.list-group-item';
          await this.page.waitForSelector(liSelector, { timeout: 4000 });
          const items = await this.page.$$(liSelector);
          for (const item of items) {
            const text = await this.page.evaluate(el => el.textContent, item);
            if (text.includes('ATTUALI')) {
              credit = await this.page.evaluate(el => {
                const badge = el.querySelector('span.badge, span');
                return badge ? badge.textContent.trim() : null;
              }, item);
              break;
            }
          }
        } catch { }
      }

      if (!credit) {
        console.error("[!] Credit not found (refresh2).");
        return { error: "Credit not found" };
      }
      this.credit = credit;
      console.log("[✓] Credit Bakecaincontrii found:refresh2", this.credit);
      this.coupon = await this.page.$$eval(
        'div.coupon.rounded-lg.flex-column.h-100.coupon-border.p-3',
        els => els.length > 0 ? 1 : 0
      ).catch(() => 0);

      let cookies = await this.page.cookies();
      if (!cookies || cookies.length === 0) {
        await this.delay(1000);
        cookies = await this.page.cookies();
      }
      if (!cookies || cookies.length === 0) return { error: "Cookies not available" };
      return [this.credit, JSON.stringify(cookies), this.coupon];
    } catch (error) {
      console.error("Bakecaincontrii Error in refresh2:", error.message);
      return { error: error.message };
    }
  }

  async getDatetimes(remoteID, isFree, cookie) {
    var otherBot = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox", '--js-flags=--expose-gc'],
      headless: true,
      defaultViewport: {
        width: 1920,
        height: 1080,
      }, executablePath: puppeteer.executablePath()

    });
    var datetimes = [];
    var rUri = "";
    const page = await otherBot.newPage();
    const cookies = JSON.parse(cookie);
    await page.setCookie(...cookies);
    if (isFree) {
      await page.goto(MANAGE_POST + remoteID);
    } else {
      await page.goto(PURCHASE_SUM + remoteID);
    }
    await page.screenshot({
      path: './preclick.jpg'
    });
    try {
      await page.click(".modal-footer button");
      await page.evaluate(`$("#lightbox-vm18").remove();`);
    } catch { }
    await page.screenshot({
      path: './postclick.jpg'
    });
    await delay(Math.random() * 1000 + 1000);

    if (await page.$(".img404") !== null) {
      otherBot.close();
      return JSON.stringify({ err: "NOT FOUND" });
    }

    rUri = await page.evaluate(async () => { return await new Promise(resolve => { resolve($(".item-title a").attr("href")); }) });
    if (rUri == null) {
      otherBot.close();
      return JSON.stringify({ err: "NOT FOUND" });
    }
    await page.screenshot({
      path: './prefetch.jpg'
    });
    if (!isFree) {
      datetimes = await page.evaluate(async () => { return await new Promise(resolve => { resolve($("span.date, td.active, td.noactive").text().split("  ")); }) });
      if (datetimes == null) datetimes = [];
      for (let x in datetimes) {
        var rTime = new RegExp("[0-9]*:[0-9]*", "g");
        try {
          let result;
          while (result = rTime.exec(datetimes[x])) {
            datetimes[x] = datetimes[x].replace(result[0], `,${result[0]}`);
          }
        } catch { }
        if (datetimes[x].indexOf(" ") == 0) datetimes[x] = datetimes[x].substring(1, datetimes[x].length);
        if (datetimes[x].indexOf("Oggi") == 0) datetimes[x] = datetimes[x].substring(5, datetimes[x].length);
      }
    }
    await page.evaluate(() => gc());
    otherBot.close();
    return { uri: rUri, datetimes: datetimes };

  }

  async edit(info, cookie) {
    console.log("Initialized suspending")
    const API_RESPONSE = await axios.post("http://localhost:9999/edit-adv", {
      adv: this.transformObject(info),
      cookies: this.formatCookies(cookie),
      remotePostID: info.remotePostID,
      expectedEmail: this.email
    }).catch((e) => console.log(e))
    console.log("RESPONSE", API_RESPONSE)
    console.log("Advertisement updated.");
  }

  async delay(time) {
    return new Promise(function (resolve) {
      setTimeout(resolve, time)
    });
  }

  formatCookies(cookie) {
    if (cookie) {
      logger.Write(`Cookie before: ${cookie}`);
      cookie = JSON.parse(cookie)
      let csrftoken = cookie.find(c => c.name === "csrftoken");
      let logged_cookie = cookie.find(c => c.name === "logged_cookie");
      let f_session_id = cookie.find(c => c.name === "f_session_id");
      return {
        csrftoken: csrftoken.value,
        logged_cookie: logged_cookie.value,
        f_session_id: f_session_id.value
      }
    }
  }

  transformObject(tblSchedulazioni) {
    const transformedObject = {
      picsAudit: tblSchedulazioni.picsAudit,
      pics: tblSchedulazioni.pics, // Replace with your desired image path
      title: tblSchedulazioni.title,
      nickname: tblSchedulazioni.nickname,
      serviceNationality: tblSchedulazioni.serviceNazionalita || "", // Replace with the desired nationality value
      hourlyPrice: tblSchedulazioni.hourlyPrice || "", // Replace with the desired hourly price
      serviceCash: tblSchedulazioni.serviceCash || false,
      serviceCreditCard: tblSchedulazioni.serviceCreditCard || false, // You didn't provide this property in the original object
      serviceAfricana: tblSchedulazioni.serviceAfricana || false,
      serviceIndiana: tblSchedulazioni.serviceIndiana || false,
      serviceAsiatica: tblSchedulazioni.serviceAsiatica || false,
      serviceAraba: tblSchedulazioni.serviceAraba || false,
      serviceLatina: tblSchedulazioni.serviceLatina || false,
      serviceCaucasica: tblSchedulazioni.serviceCaucasica || false,
      serviceItaliana: tblSchedulazioni.serviceItaliana || false,
      serviceSNaturale: tblSchedulazioni.serviceSNaturale || false,
      serviceSRifatto: tblSchedulazioni.serviceSRifatto || false,
      serviceCBiondi: tblSchedulazioni.serviceCBiondi || false,
      serviceCMarroni: tblSchedulazioni.serviceCMarroni || false,
      serviceCNeri: tblSchedulazioni.serviceCNeri || false,
      serviceCRossi: tblSchedulazioni.serviceCRossi || false,
      serviceMagro: tblSchedulazioni.serviceMagro || false,
      serviceFormoso: tblSchedulazioni.serviceFormoso || false,
      serviceNazionalita: tblSchedulazioni.serviceNazionalita || "",
      serviceOrale: tblSchedulazioni.serviceOrale || false,
      serviceAnale: tblSchedulazioni.serviceAnale || false,
      serviceSadomaso: tblSchedulazioni.serviceSadomaso || false,
      serviceEsperienzaFidanzata: tblSchedulazioni.serviceEsperienzaFidanzata || false,
      serviceAttriciPorno: tblSchedulazioni.serviceAttriciPorno || false,
      serviceEiaculazioneSulCorpo: tblSchedulazioni.serviceEiaculazioneSulCorpo || false,
      serviceMassaggioErotico: tblSchedulazioni.serviceMassaggioErotico || false,
      serviceMassaggioTantrico: tblSchedulazioni.serviceMassaggioTantrico || false,
      serviceFetish: tblSchedulazioni.serviceFetish || false,
      serviceBacioAllaFrancese: tblSchedulazioni.serviceBacioAllaFrancese || false,
      serviceGiocoDiRuolo: tblSchedulazioni.serviceGiocoDiRuolo || false,
      serviceTrio: tblSchedulazioni.serviceTrio || false,
      serviceSexting: tblSchedulazioni.serviceSexting || false,
      serviceVideoChiamata: tblSchedulazioni.serviceVideoChiamata || false,
      serviceUomini: tblSchedulazioni.serviceUomini || false,
      serviceDonne: tblSchedulazioni.serviceDonne || false,
      serviceCoppie: tblSchedulazioni.serviceCoppie || false,
      serviceDisabili: tblSchedulazioni.serviceDisabili || false,
      serviceACasa: tblSchedulazioni.serviceACasa || false,
      serviceEventiEFeste: tblSchedulazioni.serviceEventiEFeste || false,
      serviceAlbergoMotel: tblSchedulazioni.serviceAlbergoMotel || false,
      serviceClubs: tblSchedulazioni.serviceClubs || false,
      serviceVisitaADomicilio: tblSchedulazioni.serviceVisitaADomicilio || false,
      location: tblSchedulazioni.location,
      age: tblSchedulazioni.age,
      city: tblSchedulazioni.city,
      description: tblSchedulazioni.description,
      phone: tblSchedulazioni.phone,
      whatsapp: tblSchedulazioni.whatsapp,
      telegram: tblSchedulazioni.telegram,
      categorie: tblSchedulazioni.categorie,
      promo: {
        active: tblSchedulazioni.promo.active || false,
        visibility: tblSchedulazioni.promo.visibility || "",
        schedule: tblSchedulazioni.promo.schedule || "",
        premium: tblSchedulazioni.promo.premium || false,
        highlight: tblSchedulazioni.promo.highlight || false,
        etichetta: tblSchedulazioni.promo.etichetta || false,
        cam: tblSchedulazioni.promo.cam || false,
      },
    };

    return transformedObject;
  }

  async publish(info, cookie) {
    var otherBot = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox", '--js-flags=--expose-gc'],
      headless: true,
      defaultViewport: {
        width: 1920,
        height: 1080,
      },
      executablePath: puppeteer.executablePath()
    });

    var remotePostID = null;
    console.log("Sending external REQ");
    console.log({
      adv: this.transformObject(info),
      cookies: this.formatCookies(cookie)
    })

    // Send the API request
    const API_RESPONSE = await axios.post("http://localhost:9999", {
      adv: this.transformObject(info),
      cookies: this.formatCookies(cookie),
      expectedEmail: this.email
    }).catch(() => remotePostID = null);

    if (API_RESPONSE.data === "ERROR") {
      console.log("External req on error");
      remotePostID = null;
    }

    if (API_RESPONSE.data.uri) {
      try {
        const page = await otherBot.newPage();
        const cookies = JSON.parse(cookie);
        await page.setCookie(...cookies);
        await page.goto(API_RESPONSE.data.uri, { waitUntil: 'domcontentloaded' });
        await delay(1000);

        if (API_RESPONSE.data.promo) {
          console.log("External promo req resolved");
          // Get the remote post ID
          remotePostID = await this.GetRemotePostID(page, 0);
          await delay(500);
        } else {
          console.log("External free req resolved");
          remotePostID = API_RESPONSE.data.remotePostId;
        }
      } catch (error) {
        if (error.message.includes('Execution context was destroyed')) {
          console.log("Navigation error occurred, retrying...");
          // Retry the navigation or handle the error
        } else {
          console.log("Unexpected error: ", error);
        }
      } finally {
        await otherBot.close();
        console.log("Browser instance closed.");
      }
    }

    console.log("REMOTE POST ID", remotePostID);
    return remotePostID;
  }

  async publishPhoto(p, page, retry) {
    var self = this;
    try {
      const [fileChooser] = await Promise.all([
        page.waitForFileChooser(),
        page.click(".uploadphoto"),
      ]);
      await fileChooser.accept([p]);
    } catch (error) {
      if (error.message.includes('Execution context was destroyed')) {
        console.log("Navigation error during photo upload, retrying...");
        await page.waitForNavigation({ waitUntil: 'domcontentloaded' });
      } else {
        console.log("Unexpected error: ", error);
      }

      // Retry the photo upload if an error occurs and retries are left
      await delay(3000);
      if (retry < 3) {
        retry++;
        await self.publishPhoto(p, page, retry);
      }
    }
  }

  async type(page, selector, text) {
    if (!text) return;
    for (let char of text) {
      await delay(Math.random() * 1 + 5);
      await page.type(selector, char)
      await delay(Math.random() * 1 + 5);
    };
  };

  async copyText(page, selector, text) {
    if (!text) return;
    await delay(Math.random() * 1 + 5);
    await page.evaluate((sel, t) => { $(sel).val(t); }, selector, text);
    await delay(Math.random() * 1 + 5);
  };

  async GetRemotePostID(page, times) {
    if (page.url().indexOf("manage") != -1) {
      const re = /manage\/(.*?)\/$/g;
      return re.exec(page.url())[1];
    }
    else {
      times++;
      if (times > 2) {
        console.log("Times maggiore di 3");
        if (page.url().indexOf("promote") != -1) {
          console.log("L'uri contiene promote");
          try {
            await page.click(".modal-footer button");
            await delay(1000);
            await page.evaluate(`$("#app > div.modal.fade.show.d-block").remove();`);
            await page.evaluate(`$("#lightbox-vm18").remove();`);
            //await page.click(".modal-header.text-center > button");
          } catch (e) { };
          await page.click(".btn.btn-primary.waves-effect.waves-light");
          try {
            await delay(1000);
            await page.click("#visible_call_button_modal > div > div > div.modal-footer > div > div > div:nth-child(1) > button");
            await delay(4000);
          } catch (e) { };
          times = 0;
          return await this.GetRemotePostID(page, times);
        }
        if (page.url().indexOf("checkout") != -1) {
          let c = await page.url()
          console.log("CHECKOUT", c)

          console.log("Ancora in checkout");
          try {
            await page.click(".modal-footer button");
            await delay(1000);
            await page.evaluate(`$("#app > div.modal.fade.show.d-block").remove();`);
            // -- await page.evaluate(`$("#lightbox-vm18").remove();`);
            await page.click(".modal-header.text-center > button");


            await page.click("button.btn.btn-primary.w-50.rounded-pill.b1");
            await delay(1000);
          } catch (e) { };
          c = await page.url()
          console.log("CHECKOUT2", c)

          await page.screenshot({ path: "./bug1.png", fullPage: true });

          try {
            let buttonNewToPress = await page.$('#terms-and-conditions-checkout>.col-1');
            if (buttonNewToPress) {
              console.log("ho il bottone", buttonNewToPress);
              buttonNewToPress.click()
            } else {
              console.log("non ho il bottone")
            }
            await delay(1000);
          } catch (e) { console.log("errore nel premere il nuovo bottone2 ", e) };

          await page.screenshot({ path: "./bug2.png", fullPage: true });
          try {
            let popupAvviso = await page.$("#exampleModalCenter > div > div > div > button")
            if (popupAvviso) {
              popupAvviso.click()
            }
          } catch (e) {
            console.log("errore nel trovare il bottone nuovo di verifica contato ", e)
            await page.screenshot({ path: "./bug3.png", fullPage: true });
            console.log("la pagina attuale ", page)
          };
          console.log("Premo paga ora");
          //await page.click(".onlydk > button");

          await delay(1000);
          try {
            console.log("Salvo screenshot");
            await page.screenshot({ path: "./screenshots/pagopremo.png", fullPage: true });
          } catch (e) {
            console.log("screenshot errore");
          }

          //qua il bastardo clicca il secondo toggle per terms and conditions del cazzo
          try {
            // Using evaluate to switch the second toggle
            await page.evaluate(() => {
              const toggles = document.querySelectorAll('.switch-label'); // Get all toggle labels
              if (toggles.length > 1) { // Check if there are at least two toggles
                toggles[1].click(); // Simulate a click on the second toggle
              } else {
                console.log("Less than two toggle elements found.");
              }
            });
            console.log("Second terms and conditions toggle switched.");
          } catch (e) {
            console.log("Error toggling terms and conditions:", e);
          }

          try {
            await page.evaluate(() => {
              const button = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Paga');
              if (button) {
                button.click();
              }
            });
          } catch (e) {
            console.log("errore 4 ", e)
            await page.screenshot({ path: "./bug4.png", fullPage: true });
            console.log("la pagina attuale ", page)
          };


          await delay(1000);
          try {
            console.log("Salvo screenshot");
            await page.screenshot({ path: "./screenshots/pagopremo2.png", fullPage: true });
          } catch (e) {
            console.log("screenshot errore");
          }


          try {
            console.log("Risolvo recaptcha");
            await page.solveRecaptchas();
          } catch (e) {
            console.log("Captcha non risolto o non trovato");
          };


          try {
            console.log("recaptcha Fatto");
            await delay(1000);
            await page.click(".onlydk > button");
            await delay(4000);
          } catch (e) { };
          times = 0;
          return await this.GetRemotePostID(page, times);
        }
      }
      if (times > 9) {
        return null;
      }
      await page.goto(page.url());
      console.log(`${times}/9 NOT FOUND MANAGE PAGE AT: ${page.url()}`);
      await delay(500);
      return await this.GetRemotePostID(page, times);
    }
  }

  async sendRequestSuspend(private_code, callback, cookiesTMP) {
    try {
      const response = await axios.post('http://localhost:9999/suspend-adv', {
        private_code,
        cookies: this.formatCookies(cookiesTMP),
        expectedEmail: this.email
      });

      // Check if the response contains an error message
      if (response.data !== "ERROR") {
        callback(undefined);  // No error, send undefined to the callback
      } else {
        callback(response.data);  // If there's an error, pass the error message to the callback
      }
    } catch (error) {
      console.error('Error in sendRequestSuspend:', error.message);

      // Handle Axios errors
      if (error.response) {
        console.error('Response error:', error.response.data);
        callback('Server error: ' + error.response.data);
      } else if (error.request) {
        console.error('No response from server:', error.request);
        callback('No response from server. Check if the API is running.');
      } else {
        console.error('Error setting up request:', error.message);
        callback('Error in sending request: ' + error.message);
      }

      // Gracefully handle the error without crashing the application
      callback('An unexpected error occurred, but the application will continue running.');
    }
  }

  async sendRequest(data, callback, cookiesTMP) {
    cookiesTMP = JSON.parse(cookiesTMP)
    let f_session_id = cookiesTMP.find(obj => obj.name === "f_session_id")?.value
    let logged_cookie = cookiesTMP.find(obj => obj.name === "logged_cookie")?.value

    console.log(`csrftoken=${this.token}; f_session_id=${f_session_id}; logged_cookie=${logged_cookie};`)
    request(
      "https://bolzano.bakecaincontrii.com/u/contactverify/",
      {
        method: 'POST',
        headers: {
          'authority': 'bolzano.bakecaincontrii.com',
          'content-type': 'application/json;charset=UTF-8',
          'accept': 'application/json, text/plain, */*',
          'X-Requested-With': 'XMLHttpRequest',
          'X-Csrftoken': this.token,
          'origin': 'https://bolzano.bakecaincontrii.com',
          'referer': 'https://bolzano.bakecaincontrii.com/u/post-insert/',
          'accept-language': 'en-US,en;q=0.9',
          'cookie': `csrftoken=${this.token}; f_session_id=${f_session_id}; logged_cookie=${logged_cookie}; adult_cookie=1; privacy_cookie=1;`,
        },
        body: JSON.stringify(data),
      },
      (err, res, body) => {
        console.log("Server returned:", { statusCode: res && res.statusCode, body });
        callback(err, res, body);
      }
    );
  };

  async checkPhone(info) {
    const page = await this.browser.newPage();
    await page.goto(PUBLISH_URL);

    // Info section
    await page.click(".modal-footer button");
    await delay(Math.random() * 1000 + 1000);

    await page.select("select[name='category']", "5c8a29c0c5591de8c62447ce");
    await page.select("select[name='city']", info.city);

    await this.type(page, "input[name='place']", "");
    await delay(Math.random() * 20 + 30);

    await this.type(page, "input[name='age']", "20");
    await delay(Math.random() * 20 + 30);

    await this.type(page, "textarea[name='title']", "Titolo Check Phone");
    await delay(Math.random() * 20 + 30);

    await this.type(page, "textarea[name='description']", "Lorem Ipsum is simply dummy text of the printing and typesetting..");
    await delay(Math.random() * 20 + 30);

    await this.type(page, "input[name='telephone']", info.contact);
    await delay(Math.random() * 20 + 30);

    await page.click(".col-md-1 .switch .switch-label");

    await page.solveRecaptchas();
    await delay(1000);
    await page.click(".btn.btn-primary.waves-effect.waves-light");
    await delay(3000);
    await page.solveRecaptchas();
    await page.click(".modal-dialog .btn.btn-block.btn-outline-primary");

    await delay(10000);
    await page.close();
    console.log("Advertisement uploaded.");
  };
};

module.exports = BakecaincontriiBot;
