const DealsScraper = require("../../../helpers/deals-scraper");
const { default: fetch } = require("node-fetch");
const { JSDOM } = require("jsdom");

/**
 * @typedef {import("../../../helpers/deals-scraper").DealData} DealData
 * @typedef {import("../../../helpers/deals-scraper").DealTypeMeta} DealTypeMeta
 * @typedef {import("../../../config/typedefs/product").Product} Product
 * @typedef {import('puppeteer').Page} Page
 */

const BASE_URL = "https://www.takko.com/";

const SELECTORS = {
  item: ".product-wrapper",
  itemTitle: ".product-name",
  itemImage: ".image-container img",
  itemPriceCurrent: ".prices .sales .value",
  itemPriceOld: ".prices .strike-through .value",
};

class TakkoFashion extends DealsScraper {
  skipProductPageScraping = true;

  constructor() {
    super({
      referer: BASE_URL,
      origin: BASE_URL,
    });
  }

  async scrapeListPage(currentURL) {
    const html = await fetch(currentURL).then((res) => res.text());
    const { document } = new JSDOM(html).window;

    const productItems = Array.from(document.querySelectorAll(SELECTORS.item));

    return productItems.map((itemElement) => {
      const link = /**@type {HTMLAnchorElement} */ (
        itemElement.querySelector(SELECTORS.itemTitle)
      );
      const title = /**@type {HTMLElement} */ (
        itemElement.querySelector(SELECTORS.itemTitle)
      );
      const image = /**@type {HTMLImageElement} */ (
        itemElement.querySelector(SELECTORS.itemImage)
      );
      const priceCurrent = /**@type {HTMLElement} */ (
        itemElement.querySelector(SELECTORS.itemPriceCurrent)
      );
      const priceOld = /**@type {HTMLElement} */ (
        itemElement.querySelector(SELECTORS.itemPriceOld)
      );

      const priceCurrentValue = Number(priceCurrent.getAttribute("content"));
      const priceOldValue = Number(priceOld?.getAttribute("content") || "0");

      return {
        url: link.href,
        title: title.textContent?.trim() || link.title,
        image: image.dataset.src,
        priceCurrent: priceCurrentValue,
        priceOld: priceOldValue,
        discount: (100 * (priceOldValue - priceCurrentValue)) / priceOldValue,
        price_current: priceCurrentValue,
        price_old: priceOldValue,
      };
    });
  }

  async hookPreScrapeListPage(page) {
    await page.waitForSelector(SELECTORS.item);
  }

  async hookEvaluateListPageParams() {
    return [SELECTORS];
  }

  /**
   * @param {typeof SELECTORS} SELECTORS
   */
  hookEvaluateListPage(SELECTORS) {
    const productItems = Array.from(document.querySelectorAll(SELECTORS.item));

    const productsData = productItems.map((itemElement) => {
      const link = /**@type {HTMLAnchorElement} */ (
        itemElement.querySelector(SELECTORS.itemTitle)
      );
      const title = /**@type {HTMLElement} */ (
        itemElement.querySelector(SELECTORS.itemTitle)
      );
      const image = /**@type {HTMLImageElement} */ (
        itemElement.querySelector(SELECTORS.itemImage)
      );
      const priceCurrent = /**@type {HTMLElement} */ (
        itemElement.querySelector(SELECTORS.itemPriceCurrent)
      );
      const priceOld = /**@type {HTMLElement} */ (
        itemElement.querySelector(SELECTORS.itemPriceOld)
      );

      const priceCurrentValue = Number(priceCurrent.getAttribute("content"));
      const priceOldValue = Number(priceOld.getAttribute("content"));

      return {
        url: link.href,
        title: title.textContent?.trim() || link.title,
        image: image.dataset.src,
        priceCurrent: priceCurrentValue,
        priceOld: priceOldValue,
        discount: (100 * (priceOldValue - priceCurrentValue)) / priceOldValue,
        price_current: priceCurrentValue,
        price_old: priceOldValue,
      };
    });

    return productsData;
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

new TakkoFashion().start();
