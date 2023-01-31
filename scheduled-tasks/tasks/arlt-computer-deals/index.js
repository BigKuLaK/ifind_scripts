const moment = require("moment");
const DealsScraper = require("../../../helpers/deals-scraper");

/**@type {import('../../../helpers/awin/_advertisers').AdvertiserHandles} */
const ARLT_HANDLE = "arlt";
const arltComputerDeals = require("../../../config/deal-types").match(/arlt/i);

/**
 * @typedef {import("../../../helpers/deals-scraper").DealData} DealData
 * @typedef {import("../../../config/typedefs/product").Product} Product
 * @typedef {import('puppeteer').Page} Page
 */

const BASE_URL = "https://www.arlt.com/";

const PAGE_TEMPLATE = `https://www.arlt.com/index.php?cl=ith_oxelastic_latest&pgNr={{PAGE}}`;

const SELECTORS = {
  item: ".productLine",
  link: ".full-link",
  image: ".productThumbnail img",
  title: ".productTitle",
  price: ".price .price",
  pagination: ".pagination-options",
};

class ArltComputerDeals extends DealsScraper {
  skipProductPageScraping = true;

  dealType = arltComputerDeals.id;

  constructor() {
    super({
      referer: BASE_URL,
      origin: BASE_URL,
    });
  }

  async hookGetInitialProductsData() {
    /**@type {DealData[]} */
    const products = [];

    let currentPage = 0;

    // Should call 'break' when page no longer has contents
    while (true) {
      console.info(`Scraping page ${currentPage + 1}`);

      /**@type {DealData[]} */
      const scrapedProducts = await this.scrapeListPage(
        PAGE_TEMPLATE.replace("{{PAGE}}", String(currentPage))
      );

      if (scrapedProducts.length) {
        products.push(...scrapedProducts);
        currentPage++;
        continue;
      }

      // No more products found in the page
      break;
    }

    return products;
  }

  /**
   *
   * @param {Page} page
   * @returns
   */
  async hookPreScrapeListPage(page) {
    await page.waitForSelector(SELECTORS.pagination);
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
      const title = itemElement.querySelector(SELECTORS.title);
      const link = itemElement.querySelector(SELECTORS.link);
      const image = itemElement.querySelector(SELECTORS.image);
      const price = itemElement.querySelector(SELECTORS.price);

      const currentPrice = price
        ? Number(
            String(price.textContent)
              .trim()
              .replace(/[^0-9.,]/g, "")
              .replace(/[.,]/g, (match) => (match === "." ? "" : "."))
          )
        : 0;

      return {
        title: title ? String(title.textContent) : "",
        url: link ? String(link.getAttribute("href")) : "",
        image: image ? String(image.getAttribute("src")) : "",
        priceCurrent: currentPrice,
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
        deal_type: arltComputerDeals.id,
        url_list: [
          {
            price: dealData.priceCurrent,
            url: dealData.url,
          },
        ],
      });
    }

    return normalizedProductsData;
  }

  async hookPostPrerender(prerenderResponseData, products) {
    const productCreatedDates = products.map((product) =>
      moment.utc(product.updated_at).valueOf()
    );
    const latestUpdatedDate = Math.max(...productCreatedDates);

    console.log({ latestUpdatedDate });
  }
}

new ArltComputerDeals().start();
