/**
 * PREREQUISITE:
 * - Tor service configured as proxy server (source: https://levelup.gitconnected.com/anonymous-web-scrapping-with-node-js-tor-apify-and-cheerio-3b36ec6a45dc)
 * - Tor config set to german country (source: https://ab-kotecha.medium.com/how-to-connect-from-a-specific-country-without-any-vpn-but-privately-enough-through-tor-browser-5dc2d45043b)
 */

/**
 * @typedef {object} TorProxyConfig
 * @property {string} [referer]
 * @property {string} [origin]
 */

require("colors");
const fs = require("fs-extra");
const path = require("path");
const {
  existsSync,
  readFileSync,
  ensureDirSync,
  statSync,
  removeSync,
} = require("fs-extra");
const glob = require("glob");
const puppeteer = require("puppeteer-extra");

// Add stealth plugin and use defaults (all tricks to hide puppeteer usage)
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

// Add adblocker plugin to block all ads and trackers (saves bandwidth)
const AdblockerPlugin = require("puppeteer-extra-plugin-adblocker");
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

/**
 * @typedef {object} TorProxyConfig
 * @property {string} referer
 * @property {string} origin
 *
 * @typedef {typeof TorProxy}
 */

const { TORRC_PATH } = process.env;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36";

if (!TORRC_PATH || !existsSync(TORRC_PATH)) {
  throw new Error(
    `Tor config file path is not given. Please provide TORRC_PATH in env file.`
  );
}

// Parse socksport configuration from the torrc file
const portsConfig = readFileSync(TORRC_PATH)
  .toString()
  .match(/socksport\s+\d+/gi);
const availablePorts = portsConfig
  .map((portConfig) => portConfig.split(/\s+/)[1])
  .filter(Boolean);

// Set screenshot director for reference
const SCREENSHOT_DIR = path.resolve(
  __dirname,
  "../public/screenshots/tor-proxy"
);

class TorProxy {
  /**@param {TorProxyConfig} param */
  constructor({ referer, origin } = { referer: "", origin: "" }) {
    this.referer = referer;
    this.origin = origin;

    // Cleanup old  puppeteer_dev_profile files
    const temporaryFiles = glob.sync("/tmp/puppeteer_dev_profile-*");

    // Remove old files
    const todayMs = Date.now();
    const onWeekAgoMs = 1000 * 60 * 60 * 24 * 7;
    const oldTemporaryFiles = temporaryFiles.forEach((filePath) => {
      const { ctimeMs, atimeMs, mtimeMs, birthtimeMs } = statSync(filePath);
      const earliestTimeMs = Math.min(ctimeMs, atimeMs, mtimeMs, birthtimeMs);
      const diffMs = todayMs - earliestTimeMs;
      const isOneWeekAgo = diffMs >= onWeekAgoMs;

      if (isOneWeekAgo) {
        console.info(`[TOR-PROXY] Removing old temp file: ${filePath}`.gray);
        removeSync(filePath);
      }
    });
  }

  /**
   *
   * Creates a new instance of this class
   */
  static create(config) {
    return new TorProxy(config);
  }

  /**
   * Generates a new page using the current browser
   * @return {Promise<import('puppeteer').Page>}
   */
  async newPage(newBrowser = false) {
    /* Ensure a browser instance is present */
    if (!this.browser || newBrowser) {
      await this.launchNewBrowser();
    }

    /* Close all other pages/tabs */
    await this.closePages();

    /* Log */
    console.info(`- Getting new page.`);

    /* Create new Page */
    const page = await this.browser.newPage();

    console.info(`- New page created.`);

    /* Apply desktop breakpoint */
    await page.setViewport({
      width: 1920,
      height: 10000,
    });

    const extraHTTPHeaders = {
      "user-agent": USER_AGENT,
    };

    if (this.referer) {
      extraHTTPHeaders.referer = this.referer;
    }

    if (this.origin) {
      extraHTTPHeaders.origin = this.referer;
    }

    /* Apply custom headers */
    await page.setExtraHTTPHeaders(extraHTTPHeaders);

    console.info(`- Page configured.`);

    /* Return new page */
    return page;
  }

  /**
   * Launches a new browser with proxy settings
   */
  async launchNewBrowser() {
    /* Get proxy */
    const proxy = this.generateProxy();

    /* Close existing browser if there is any */
    console.log(`Closing existing browser...`);
    if (this.browser && this.browser.close) {
      await this.browser.close();
    }

    /* Log */
    console.info(`- Launching new browser using proxy: ${proxy.bold}`);

    /* Launching browser */
    this.browser = await puppeteer.launch({
      ignoreHTTPSErrors: true,
      args: [
        `--proxy-server=${proxy}`,
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--ignore-certificate-errors",
        "--ignore-certificate-errors-spki-list",
      ],
    });

    /* Nullify reference to browser if disconnected */
    this.browser.on("disconnected", () => {
      this.browser = null;
    });
  }

  /**
   * Generates a proxy to be used for the Puppeteer browser launch
   * e.g., socks5://127.0.0.1:9050
   * @returns String ()
   */
  generateProxy() {
    const port = this.getSocksPort();
    return `socks5=127.0.0.1:${port}`;
  }

  /**
   * Selects a port from the Torrc SocksPorts list
   * @returns Number
   */
  getSocksPort() {
    const randomIndex = Math.round(Math.random() * (availablePorts.length - 1));
    return availablePorts[randomIndex];
  }

  /**
   * Close all current pages
   */
  async closePages() {
    const pages = await this.browser.pages();
    await Promise.all(pages.map((page) => page.close()));
  }

  /**
   * Close browser
   */
  async close() {
    await this.browser?.close();
  }

  async saveScreenShot(folderSuffix = "") {
    const [page] = await this.browser.pages();
    const url = await page.url();

    // Build this page's screenshot directory path
    const screenshotDir = path.resolve(
      SCREENSHOT_DIR,
      url
        .replace(/[\/]+/g, "/")
        .replace(/\?.+$/, "")
        .replace(/[^\/a-z0-9-_.]+/gi, "_") + folderSuffix
    );

    // Ensure directory is present
    ensureDirSync(screenshotDir);

    // Getting page content
    const html = await page.content();

    // Save screenshot
    console.info(`- Saving screenshot at ${screenshotDir.bold}`);
    fs.outputFileSync(path.resolve(screenshotDir, "index.html"), html);

    await page.screenshot({
      path: path.resolve(screenshotDir, "screenshot.jpg"),
      fullPage: true,
    });
  }
}

/**@param {TorProxyConfig} config */
module.exports = (config) => TorProxy.create(config);
module.exports.TorProxy = TorProxy;
