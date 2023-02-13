const DealsScraper = require("../../../helpers/deals-scraper");

/**
 * @typedef {import("../../../helpers/deals-scraper").DealData} DealData
 * @typedef {import("../../../config/typedefs/product").Product} Product
 * @typedef {import('puppeteer').Page} Page
 */

const BASE_URL = "https://www.tom-tailor.de";
const LIST_PAGE_URL = `https://www.tom-tailor.de/herren-startseite`;

const SELECTORS = {
  item: ".product-tile",
  itemLink: "a",
  itemTitle: ".product-tile__h5",
  itemImage: ".product-tile__img--main",
  itemPrice: ".product-tile__price",
};

class TomTailorMensWear extends DealsScraper {
  skipProductPageScraping = true;

  constructor() {
    super({
      referer: BASE_URL,
      origin: BASE_URL,
    });

    this.taskData = JSON.parse(process.env.taskData);
    this.dealType = this.taskData.meta.deal_type;
  }

  async hookGetInitialProductsData() {
    /**@type {DealData[]} */
    const products = await this.scrapeListPage(LIST_PAGE_URL);

    return products;
  }

  /**
   *
   * @param {Page} page
   * @returns
   */
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
        itemElement.querySelector(SELECTORS.itemLink)
      );
      const title = /**@type {HTMLElement} */ (
        itemElement.querySelector(SELECTORS.itemTitle)
      );
      const image = /**@type {HTMLImageElement} */ (
        itemElement.querySelector(SELECTORS.itemImage)
      );
      const price = /**@type {HTMLElement} */ (
        itemElement.querySelector(SELECTORS.itemPrice)
      );

      const swapCommaAndDecimal = (match) => (/[. ]/.test(match) ? "," : ".");

      return {
        url: link.href,
        title: title.textContent?.trim() || link.title,
        image: image.currentSrc,
        priceCurrent: Number(
          (price.textContent?.trim() || "").replace(
            /[. ]/gi,
            swapCommaAndDecimal
          )
        ),
      };
    });

    return productsData;
  }

  /**
   * @param {DealData[]} initialProductsData
   */
  async hookNormalizeProductsData(initialProductsData) {
    /**@type {Product[]} */
    const normalizedProductsData = [];

    for (let dealData of initialProductsData) {
      normalizedProductsData.push({
        title: dealData.title,
        image: dealData.image,
        deal_type: this.dealType,
        url_list: [
          {
            price: dealData.priceCurrent,
            url: dealData.url,
            price_original: dealData.priceOld,
          },
        ],
      });
    }

    return normalizedProductsData;
  }
}

new TomTailorMensWear().start();
