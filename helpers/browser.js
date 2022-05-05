/**
 * Leverages Puppeteer
 */
require("colors");
const puppeteer = require("puppeteer");
const EventEmitter = require("events");

const BROWSER_IDLE_TIMEOUT = 1000 * 60 * 3;
const PAGE_IDLE_TIMEOUT = 1000 * 60 * 2;

class Browser {
  constructor() {
    Browser.on("disconnected", () => {
      this.page = null;
    });

    this.class = this.__proto__.constructor;
  }

  async getBrowserInstance() {
    return await Browser.getInstance();
  }

  async getPageInstance() {
    this.resetPageIdleWatcher();

    if (!this.page) {
      const browser = await this.getBrowserInstance();
      this.page = await browser.newPage();
      await this.page.setViewport({
        width: 1920,
        height: 3000,
      });
    }

    return this.page;
  }

  /**
   *
   * @param {String} url
   * @param {String} waitForSelector
   * @returns Page instance
   */
  async goTo(url, waitForSelector = "body") {
    const page = await this.getPageInstance();
    await page.goto(url, { timeout: 9999999 });
    await page.waitForSelector(waitForSelector);
    return page;
  }

  async getHtml() {
    const page = await this.getPageInstance();
    const bodyHtml = await page.$eval("body", (el) => el.innerHTML);
    return bodyHtml;
  }

  // Watches for page idle
  // If this.getPageInstance or this.getBrowserInstance
  // have not been called around 1min, then this
  // invalidates the puppeteer Page instance to avoid memory leak
  async resetPageIdleWatcher() {
    Browser.resetBrowserIdleWatcher();

    if (this.pageIdleTimer) {
      clearTimeout(this.pageIdleTimer);
    }

    this.pageIdleTimer = setTimeout(async () => {
      console.log("Page has been idle, closing instance...".cyan);
      const page = await this.page;
      page.close(); // no need to await
      this.page = null;
    }, PAGE_IDLE_TIMEOUT);
  }

  async callPageFunction(pageFunction, ...args) {
    const page = await this.getPageInstance();
    return page[pageFunction].apply(page, args);
  }

  /**
   * Puppeteer page methods
   */
  async goto(...args) {
    return this.callPageFunction("goto", ...args);
  }
  async waitForSelector(...args) {
    return this.callPageFunction("waitForSelector", ...args);
  }
  async click(...args) {
    return this.callPageFunction("click", ...args);
  }
  async evaluate(...args) {
    return this.callPageFunction("evaluate", ...args);
  }
  async $eval(...args) {
    return this.callPageFunction("$eval", ...args);
  }
  async $$eval(...args) {
    return this.callPageFunction("$$eval", ...args);
  }
  async waitForResponse(...args) {
    return this.callPageFunction("waitForResponse", ...args);
  }
  async reload(...args) {
    return this.callPageFunction("reload", ...args);
  }
  async setViewport(...args) {
    return this.callPageFunction("setViewport", ...args);
  }
  async screenshot(...args) {
    return this.callPageFunction("screenshot", ...args);
  }
  async setGeolocation(...args) {
    return this.callPageFunction("setGeolocation", ...args);
  }
  async url() {
    return this.callPageFunction("url");
  }
}

/**
 * Static props
 */
Browser.eventEmitter = new EventEmitter();

/**
 * Static methods
 */
Browser.on = function (event, callback) {
  this.eventEmitter.on(event, callback);
};

Browser.getInstance = async function () {
  this.resetBrowserIdleWatcher();

  if (!this.browser) {
    console.log("Creating a puppeteer browser instance...".cyan);

    const browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    console.log("Browser instance created".cyan);
    this.browser = this.browser || browser;
  }

  return this.browser;
};

Browser.resetBrowserIdleWatcher = async function () {
  if (this.browserIdleTimer) {
    clearTimeout(this.browserIdleTimer);
  }

  this.browserIdleTimer = setTimeout(async () => {
    // Close browser instance if not accessed within 3 minutes
    console.log("Browser has been idle, closing instance...".cyan);
    const browser = await this.browser;
    browser.close(); // no need to await
    this.browser = null;
    this.eventEmitter.emit("close");
  }, BROWSER_IDLE_TIMEOUT);
};

module.exports = new Browser();
