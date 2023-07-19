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
  list: '[data-zta="recoSlider"]',
  item: '[class*="RecommendationProductCard-module_slideCard"]',
  itemTitle: '[class*="RecommendationProductCard-module_cardNameItem"]',
  itemImage: "img",
  itemPriceOld: '[class*="RecommendationProductCard-module_priceLine"]',
  itemPriceCurrent: '[class*="RecommendationProductCard-module_priceCurrent"]',
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

    return items.map((el) => {
      const title =
        el.querySelector(SELECTORS.itemTitle)?.textContent?.trim() || "";
      const image =
        el.querySelector(SELECTORS.itemImage)?.getAttribute("data-src") || "";
      const url = el.href;

      const [priceCurrentText] =
        el
          .querySelector(SELECTORS.itemPriceCurrent)
          ?.textContent?.match(/[0-9.,]+/) || [];
      const [priceOldText] =
        el
          .querySelector(SELECTORS.itemPriceOld)
          ?.textContent?.match(/[0-9.,]+/) || [];

      const priceCurrent = priceCurrentText;
      const priceOld = priceOldText;

      return {
        title,
        image,
        url,
        priceCurrent,
        priceOld,
      };
    });
  }

  async hookProcessInitialProducts(products) {
    return products.map((product) => {
      const priceCurrent = product.priceCurrent
        ? Number(swapDotAndComma(product.priceCurrent))
        : 0;
      const priceOld = product.priceOld
        ? Number(swapDotAndComma(product.priceOld))
        : 0;

      product.priceCurrent = priceCurrent;
      product.priceOld = priceOld;

      if (priceOld) {
        product.discount = ((priceOld - priceCurrent) / priceOld) * 100;
      }

      return product;
    });
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
