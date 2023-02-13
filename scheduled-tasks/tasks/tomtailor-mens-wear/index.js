const DealsScraper = require("../../../helpers/deals-scraper");

/**
 * @typedef {import("../../../helpers/deals-scraper").DealData} DealData
 * @typedef {import("../../../config/typedefs/product").Product} Product
 * @typedef {import('puppeteer').Page} Page
 */

const BASE_URL = "https://www.tom-tailor.de";
const LIST_PAGE_URL = `https://www.tom-tailor.de/herren-startseite`;

const SELECTORS = {
  languageSwitch: '[data-testid="discountDropdownButton"] + div',
  germanSwitchButton: 'a[data-testid="languageCountrySwitchLanguage-German"]',
  item: 'li[data-testid^="productTileTracker"]',
  itemLink: "a",
  itemImage: "img",
  productTitle: '[data-testid="productName"]',
  productImage: '[data-testid="productImage"] img',
  productPriceCurrent: '[data-testid="finalPrice"]',
  productPriceOld: '[data-testid="campaignStruckPrice"]',
};

class TomTailorMensWear extends DealsScraper {
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
    await this.saveScreenShot("--test");
    process.exit();
    // await page.waitForSelector(SELECTORS.languageSwitch);
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
      /**@type {HTMLAnchorElement|null} */
      const link = itemElement.querySelector(SELECTORS.itemLink);

      return {
        url: link ? String(link.href) : "",
      };
    });

    return productsData;
  }

  /**
   * @param {Page} page
   */
  async hookPreScrapeProductPage(page) {
    await page.waitForSelector(SELECTORS.productTitle);
  }

  async hookEvaluateProductPageParams() {
    return [SELECTORS];
  }

  async hookEvaluateProductPage(SELECTORS) {
    const title = document.querySelector(SELECTORS.productTitle);
    const priceCurrentElement = document.querySelector(
      SELECTORS.productPriceCurrent
    );
    const priceOldElement = document.querySelector(SELECTORS.productPriceOld);

    let image = null;
    let imageSrcTries = 10;

    while (!image?.currentSrc && imageSrcTries--) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      image = document.querySelector(SELECTORS.productImage);
    }

    const swapCommaAndDecimal = (match) => (/[. ]/.test(match) ? "," : ".");
    const priceCurrent = Number(
      priceCurrentElement.textContent
        .match(/[0-9,. ]+/)[0]
        .trim()
        .replace(/[. ,]/, swapCommaAndDecimal)
    );
    const priceOld = Number(
      priceOldElement?.textContent
        .match(/[0-9,. ]+/)[0]
        .trim()
        .replace(/[. ,]/, swapCommaAndDecimal) || priceCurrent
    );
    const discount = (1 - priceCurrent / priceOld) * 100;

    return {
      title: title.textContent.trim(),
      image: image?.currentSrc || image?.src,
      priceCurrent,
      priceOld,
      discount,
    };
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
            discount_percent: dealData.discount,
          },
        ],
      });
    }

    return normalizedProductsData;
  }
}

new TomTailorMensWear().start();
