const DealsScraper = require("../../../helpers/deals-scraper");
const { swapDotAndComma } = require("../../../ifind-utilities/currency");
const { JSDOM } = require("jsdom");
const { default: fetch } = require("node-fetch");

/**
 * @typedef {import("../../../helpers/deals-scraper").DealData} DealData
 * @typedef {import("../../../helpers/deals-scraper").DealTypeMeta} DealTypeMeta
 * @typedef {import("../../../config/typedefs/product").Product} Product
 * @typedef {import('jsdom').DOMWindow} DOMWindow
 * @typedef {DOMWindow}
 */

const BASE_URL = "https://www.bitiba.de";

const SELECTORS = {
  list: '[data-name="container_1"]',
  item: '[class*="RecommendationProductCard-module_slideCard"]',
};

class Bitiba extends DealsScraper {
  skipProductPageScraping = true;

  constructor() {
    super({
      referer: BASE_URL,
      origin: BASE_URL,
    });
  }

  async hookEvaluateListPageParams() {
    return [SELECTORS, BASE_URL];
  }

  async hookPreScrapeListPage(page) {
    await page.waitForSelector(SELECTORS.list);
    await this.saveScreenShot();
  }

  // Using puppeteer due to 403 error when using a native fetch for the URL
  async hookEvaluateListPage(SELECTORS, BASE_URL) {
    const items = Array.from(document.querySelectorAll(SELECTORS.item));
    return items.map((el) => el.textContent);
  }

  async hookInspectListPageProducts(products) {
    console.log("products", products);
  }

  async hookProcessInitialProducts(products) {
    if (products[0].type === "error") {
      console.log(products[0].data);
      throw products[0].error.message;
    }

    return products;
  }

  /**
   * @param {DealData[]} initialProductsData
   * @param {DealTypeMeta} dealType
   */
  async hookNormalizeProductsData(initialProductsData, dealType) {
    /**@type {Product[]} */
    const normalizedProductsData = [];

    for (let dealData of initialProductsData) {
      normalizedProductsData.push({
        title: dealData.title,
        image: dealData.image,
        deal_type: dealType.id,
        url_list: [
          {
            price: dealData.priceCurrent,
            url: dealData.url,
            price_original: dealData.priceOld,
            discount_percent: dealData.discount,
          },
        ],
      });
    }

    return normalizedProductsData;
  }
}

new Bitiba().start();
