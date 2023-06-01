const DealsScraper = require("../../../helpers/deals-scraper");
const { addURLParams } = require("../../../helpers/url");
const { default: fetch } = require("node-fetch");

/**
 * @typedef {import("../../../helpers/deals-scraper").DealData} DealData
 * @typedef {import("../../../helpers/deals-scraper").DealTypeMeta} DealTypeMeta
 * @typedef {import("../../../config/typedefs/product").Product} Product
 * @typedef {import('puppeteer').Page} Page
 */

const BASE_URL = "https://www.lidl.de";
const PRODUCTS_PER_PAGE = 100;
const MAX_PAGE = 3;

class LidlOffers extends DealsScraper {
  skipProductPageScraping = true;

  constructor() {
    super({
      referer: BASE_URL,
      origin: BASE_URL,
    });
  }

  async hookListPagePaginatedURL(url, currentPage) {
    return currentPage <= MAX_PAGE
      ? addURLParams(url, { offset: (currentPage - 1) * PRODUCTS_PER_PAGE })
      : false;
  }

  async hookPreScrapeListPage() {
    // void
  }

  async hookEvaluateListPageParams() {
    return [];
  }

  /**
   *
   * @param {string} listPageURL
   * @return {Promise<Partial<DealData>[]>}
   */
  async scrapeListPage(listPageURL) {
    const data = await fetch(listPageURL).then((res) => res.json());

    return data.items.map(({ gridbox: { data } }) => {
      return {
        title: data.fullTitle,
        image: data.image,
        url: `${BASE_URL}${data.canonicalUrl}`,
        priceCurrent: data.price.price,
        priceOld:
          (data.price.discount
            ? data.price.oldPrice ||
              data.price.recommendedPrice ||
              data.price.discount.deletedPrice
            : null) || null,
        discount: data.price.discount
          ? data.price.discount.percentageDiscount
          : null,
      };
    });
  }

  async hookProcessInitialProducts(initialProducts) {
    // Sort merged initial products by highest discount
    initialProducts.sort((productA, productB) =>
      productA.discount > productB.discount ? -1 : 1
    );

    return initialProducts;
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

new LidlOffers().start();
