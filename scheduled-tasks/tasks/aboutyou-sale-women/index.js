const DealsScraper = require("../../../helpers/deals-scraper");

/**
 * @typedef {import("../../../helpers/deals-scraper").DealData} DealData
 * @typedef {import("../../../config/typedefs/product").Product} Product
 * @typedef {import('puppeteer').Page} Page
 */

const BASE_URL = "https://www.aboutyou.de";
const LIST_PAGE_URL = `https://www.aboutyou.de/c/frauen/sale-32543`;
const MIN_PRODUCTS = 60;
const MAX_SCROLL_TRIES = 10;

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
class AboutYouSaleWomen extends DealsScraper {
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
    // Change language
    // -- Wait for switch element
    await page.waitForSelector(SELECTORS.languageSwitch);
    // -- Show language selections popup
    await page.click(SELECTORS.languageSwitch);
    // - Delay to ensure language selections popup is visible
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // -- Click on the German button and wait for the elements to load
    await page.click(SELECTORS.germanSwitchButton);
    await page.waitForSelector(SELECTORS.item);

    let visibleProducts = 0;
    let scrollTries = MAX_SCROLL_TRIES;

    while (visibleProducts < MIN_PRODUCTS && scrollTries--) {
      visibleProducts = await page.$$eval(
        SELECTORS.item,
        (items) => items.length
      );
      console.log(`Got ${visibleProducts} products. Scrolling to view more.`);
      await page.evaluate(() => window.scrollBy(0, 1000));
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
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

new AboutYouSaleWomen().start();
