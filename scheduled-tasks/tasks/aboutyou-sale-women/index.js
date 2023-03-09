const DealsScraper = require("../../../helpers/deals-scraper");

/**
 * @typedef {import("../../../helpers/deals-scraper").DealData} DealData
 * @typedef {import("../../../config/typedefs/product").Product} Product
 * @typedef {import('puppeteer').Page} Page
 */

const BASE_URL = "https://www.aboutyou.de";
const MAX_SCROLL_TRIES = 10;
const MAX_PRODUCTS = 200;

const SELECTORS = {
  languageSwitch: '[data-testid="languageCountrySwitch"]',
  germanSwitchButton: 'a[data-testid="languageCountrySwitchLanguage-German"]',
  item: 'li[data-testid^="productTileTracker"]',
  itemLink: "a",
  itemImage: "img",
  productTitle: '[data-testid="productName"]',
  productImage: '[data-testid="productImage"] img',
  productPriceCurrent: '[data-testid="finalPrice"]',
  productPriceOld:
    '[data-testid="campaignStruckPrice"], [data-testid="saleStruckPrice"]',
  productCampaign: "[data-tadarida-initial-state]",
};
class AboutYouSaleWomen extends DealsScraper {
  constructor() {
    super({
      referer: BASE_URL,
      origin: BASE_URL,
    });
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

    while (scrollTries && visibleProducts < MAX_PRODUCTS) {
      const queriedItems = await page.$$eval(
        SELECTORS.item,
        (items) => items.length
      );

      console.info(`Got ${queriedItems} products. Scrolling to view more.`);
      await page.evaluate(() => window.scrollBy(0, 1000));
      await new Promise((resolve) => setTimeout(resolve, 2000));

      if (queriedItems === visibleProducts) {
        if (--scrollTries) {
          continue;
        } else {
          break;
        }
      } else {
        visibleProducts = queriedItems;
        scrollTries = MAX_SCROLL_TRIES;
      }
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
    const campaign = document.querySelector(SELECTORS.productCampaign);

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
        .replace(/[. ,]/, swapCommaAndDecimal) || null
    );
    const discount = priceOld ? (1 - priceCurrent / priceOld) * 100 : null;

    const productData = {
      title: title.textContent.trim(),
      image: image?.currentSrc || image?.src,
      priceCurrent,
      priceOld,
      discount,
    };

    // Extract expiry details from the rendered SEO data
    if (campaign) {
      const endDate = (campaign.textContent.match(/endDate[": ]+([^"]+)/i) ||
        [])[1];

      if (endDate) {
        productData.dealExpiry = new Date(endDate).getTime();
      }
    }

    return productData;
  }

  /**
   * @param {DealData[]} initialProductsData
   */
  async hookNormalizeProductsData(initialProductsData, dealType) {
    /**@type {Product[]} */
    const normalizedProductsData = [];

    for (let dealData of initialProductsData) {
      normalizedProductsData.push({
        title: dealData.title,
        image: dealData.image,
        deal_type: dealType.id,
        deal_expiry: dealData.dealExpiry,
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
