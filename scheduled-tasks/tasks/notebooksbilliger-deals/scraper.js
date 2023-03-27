/**
 * Type imports
 * @typedef {object} DealData
 * @property {string} url
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
const createTorProxy = require("../../../helpers/tor-proxy");

const NAVIGATION_TIMEOUT = 60000;

const DEALS_URL = `https://www.notebooksbilliger.de/angebote`;

const SELECTORS = {
  dealItem: `a.js-deal-item:not([href^="/angebote"])`,
  image:
    ".image-modal__list-item:first-child img, .pdp-image-slider__preview-image",
  title: ".product-heading",
  priceCurrent: ".product-price__price",
  priceOld: ".label__old-price",
  discount: ".label__discount",
};

class NotebooksBilligerScraper {
  static #torProxyBrowser;

  /** @type {puppeteer.Browser} */
  static #browser;

  /** @type {puppeteer.Page} */
  static #page;

  static async getDeals() {
    await this.#initializeBrowser();

    /** @type {Array<string>} */
    const productLinks = await this.getDealsLinks();

    /**@type {Array<DealData>} */
    const productsData = await this.getDataFromLinks(productLinks);

    await this.#torProxyBrowser.close();

    return productsData;
  }

  static async #initializeBrowser() {
    this.#torProxyBrowser = createTorProxy();
    this.#page = await this.#torProxyBrowser.newPage();
  }

  static async getDealsLinks() {
    console.info(`Getting product links.`.green);

    let dealsPageLoaded = false;
    let tries = 3;

    while (tries--) {
      try {
        await this.#page.goto(DEALS_URL, {
          timeout: NAVIGATION_TIMEOUT,
        });

        dealsPageLoaded = true;
        break;
      } catch (err) {
        console.error(err);
        continue;
      }
    }

    if (!dealsPageLoaded) {
      throw new Error("Unable to load deals page.");
    }

    /**@type {Array<string>} */
    const productLinks = await this.#page.evaluate(
      this.pageGetProductLinks,
      SELECTORS.dealItem
    );

    console.info(`Got links for ${productLinks.length} products.`.green);

    // First link is the deals page, remove it.
    return productLinks.slice(1);
  }

  /**@param {Array<string>} _productLinks */
  static async getDataFromLinks(_productLinks) {
    console.info(`Getting products data.`.green);

    const productLinks = _productLinks;

    /**@type {DealData[]} */
    const scrapedData = [];

    for (let index = 0; index < productLinks.length; index++) {
      console.info(`Scraping ${index + 1} of ${productLinks.length}`.gray);

      await pause(1000);

      let tries = 3;

      while (tries--) {
        try {
          /**@type {DealData} */
          const dealData = await this.getDataFromLink(productLinks[index]);

          console.info(`Scraped data for ${dealData.title}`.green);

          scrapedData.push(dealData);
          break;
        } catch (err) {
          console.warn(err.message);
          console.warn(`Error in scraping data. Retrying...`.gray);
        }
      }
    }

    return scrapedData;
  }

  /**@param {string} productLink */
  static async getDataFromLink(productLink) {
    await this.#page.goto(productLink, {
      timeout: NAVIGATION_TIMEOUT,
    });

    const productData = await this.#page.evaluate(
      this.pageScrapeProduct,
      SELECTORS
    );

    return {
      url: productLink,
      ...productData,
    };
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
    const priceCurrent = document
      .querySelector(SELECTORS.priceCurrent)
      ?.getAttribute("data-original-price")
      ?.trim()
      .replace(/[^0-9.,]/g, "");

    /**@type number */
    const priceOld = document
      .querySelector(SELECTORS.priceOld)
      ?.textContent?.trim()
      .replace(/[^0-9.,]/g, "");

    return {
      title,
      image,
      priceCurrent,
      priceOld,
    };
  }
}

module.exports = NotebooksBilligerScraper;
