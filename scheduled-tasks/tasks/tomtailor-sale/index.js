const DealsScraper = require("../../../helpers/deals-scraper");

/**
 * @typedef {import("../../../helpers/deals-scraper").DealData} DealData
 * @typedef {import("../../../helpers/deals-scraper").DealTypeMeta} DealTypeMeta
 * @typedef {import("../../../config/typedefs/product").Product} Product
 * @typedef {import('puppeteer').Page} Page
 */

const BASE_URL = "https://www.tom-tailor.de";

const SELECTORS = {
  pagination: ".pagination__button",
  item: ".product-tile",
  itemLink: "a",
  itemTitle: ".product-tile__h5",
  itemImage: ".product-tile__img--main",
  itemPriceCurrent: ".product-tile__price--sale",
  itemPriceOld: ".product-tile__price--dashed",
  itemDiscount: ".product-tile__flags .flag--danger .flag__text",
};

const MAX_PAGE = 5;

class TomTailorSale extends DealsScraper {
  skipProductPageScraping = true;

  constructor() {
    super({
      referer: BASE_URL,
      origin: BASE_URL,
    });

    console.log("test");
  }

  async hookListPagePaginatedURL(baseURL, currentPage) {
    return currentPage <= MAX_PAGE
      ? `${baseURL}?slug=kids&slug=sale&cursor=offset%3A${
          (currentPage - 1) * 48
        }`
      : false;
  }

  /**
   *
   * @param {Page} page
   */
  async hookPreScrapeListPage(page) {
    await page.waitForSelector(SELECTORS.item);
    await new Promise((res) => setTimeout(res, 2000));
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
        itemElement.querySelector(SELECTORS.itemLink)
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
      const discount = /**@type {HTMLElement} */ (
        itemElement.querySelector(SELECTORS.itemDiscount)
      );

      const swapCommaAndDecimal = (match) => (/[. ]/.test(match) ? "," : ".");

      return {
        url: link.href,
        title: title.textContent?.trim() || link.title,
        image: image.src,
        priceCurrent: Number(
          (priceCurrent.textContent || "")
            .replace(/[^., 0-9]+/g, "")
            .trim()
            .replace(/[. ,]/gi, swapCommaAndDecimal)
        ),
        priceOld: Number(
          (priceOld.textContent || "")
            .replace(/[^., 0-9]+/g, "")
            .trim()
            .replace(/[. ,]/gi, swapCommaAndDecimal)
        ),
        discount: Number((discount.textContent || "").replace(/[^0-9]+/g, "")),
        price_current: priceCurrent.textContent,
        price_old: priceOld.textContent,
        discount_text: discount.textContent,
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

new TomTailorSale().start();
