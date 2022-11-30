/**
 * Type imports
 * @typedef {object} DealData
 * @property {string} title
 * @property {string} image
 * @property {number} priceCurrent
 * @property {number} priceOld
 * @property {number} discount
 */
require("colors");
const fs = require("fs-extra");
const puppeteer = require("puppeteer");
const pause = require("../../../helpers/pause");

const DEALS_URL = `https://www.notebooksbilliger.de/angebote`;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36";

const SELECTORS = {
  dealItem: `a.js-deal-item:not([href^="/angebote"])`,
  image: ".image-modal__list-item:first-child img",
  title: ".product-heading",
  priceCurrent: ".product-price__price",
  priceOld: ".label__old-price",
  discount: ".label__discount",
};

class NotebooksBilligerScraper {
  /** @type {puppeteer.Browser} */
  static #browser;

  /** @type {puppeteer.Page} */
  static #page;

  static async getDeals() {
    await this.#initializeBrowser();

    /** @type {Array<string>} */
    const productLinks = await this.getDealsLinks();

    /**@type {Array<DealData>} */
    const productsData = await this.getDataFromLinks(productLinks.slice(0, 1));

    await this.#browser.close();
  }

  static async #initializeBrowser() {
    this.#browser = await puppeteer.launch({
      args: ["--incognito"],
    });
    this.#page = await this.#browser.newPage();

    // Apply headers
    await this.#page.setExtraHTTPHeaders({
      "user-agent": USER_AGENT,
      "upgrade-insecure-requests": "1",
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3",
      "accept-encoding": "gzip, deflate, br",
      "accept-language": "en-US,en;q=0.9,en;q=0.8",
      origin: DEALS_URL,
      referer: DEALS_URL,
    });
  }

  static async getDealsLinks() {
    console.info(`Getting product links.`.green);

    await this.#page.goto(DEALS_URL);

    /**@type {Array<string>} */
    const productLinks = await this.#page.evaluate(
      this.pageGetProductLinks,
      SELECTORS.dealItem
    );

    console.info(`Got links for ${productLinks.length} products.`.green);

    // First link is the deals page, remove it.
    return productLinks.slice(1);
  }

  /**@param {Array<string>} productLinks */
  static async getDataFromLinks(productLinks) {
    console.info(`Getting products data.`.green);

    /**@type {DealData[]} */
    const scrapedData = [];

    for (let index = 0; index < productLinks.length; index++) {
      console.info(`Scraping ${index + 1} of ${productLinks.length}`.gray);

      pause(3000);

      /**@type {DealData} */
      const dealData = await this.getDataFromLink(productLinks[index]);

      if (!dealData.title) {
        fs.outputFileSync("deal.html", await this.#page.content());
      }

      console.log({ link: productLinks[index], dealData });

      console.info(`Scraped data for ${dealData.title}`.green);

      scrapedData.push(dealData);
    }

    return scrapedData;
  }

  /**@param {string} productLink */
  static async getDataFromLink(productLink) {
    await this.#page.goto(productLink);

    fs.outputFileSync("deal.html", await this.#page.content());

    const productData = await this.#page.evaluate(
      this.pageScrapeProduct,
      SELECTORS
    );

    return productData;
  }

  static pageGetProductLinks(DEAL_ITEM_SELECTOR) {
    /** @type {HTMLAnchorElement[]} */
    const dealItems = Array.from(document.querySelectorAll(DEAL_ITEM_SELECTOR));

    return dealItems.map(({ href }) => href);
  }

  static pageScrapeProduct(SELECTORS) {
    /**@type {string} */
    const title =
      document.querySelector(SELECTORS.title)?.textContent.trim() || "";

    /**@type {string} */
    const image = document.querySelector(SELECTORS.image)?.src || "";

    /**@type number */
    const priceCurrent =
      (document
        .querySelector(SELECTORS.priceCurrent)
        ?.getAttribute("data-original-price")
        .replace(",", ".") || 0) * 1;

    /**@type number */
    const priceOld =
      (document
        .querySelector(SELECTORS.priceOld)
        ?.textContent.replace(",", ".")
        .replace(/[^0-9.]/g, "") || priceCurrent) * 1;

    // * @property {number} priceCurrent
    // * @property {number} priceOld
    // * @property {number} discount

    return {
      title,
      image,
      priceCurrent,
      priceOld,
    };
  }
}

module.exports = NotebooksBilligerScraper;
