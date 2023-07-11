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

class Bitiba extends DealsScraper {
  skipProductPageScraping = true;

  constructor() {
    super({
      referer: BASE_URL,
      origin: BASE_URL,
    });
  }

  /**@returns {Promise<DealData[]>} */
  async scrapeListPage(currentURL) {
    const data = await fetch(currentURL).then((res) => res.json());

    /**@type {DealData[]} */
    const items = data
      .map(({ recommendations }) => recommendations)
      .flat()
      .map(({ product_name, link, image, before_price, current_price }) => ({
        title: product_name,
        url: BASE_URL + link,
        image,
        priceCurrent: current_price,
        priceOld:
          before_price && current_price !== before_price ? before_price : null,
        discount:
          before_price && current_price !== before_price
            ? ((before_price - current_price) / before_price) * 100
            : 0,
      }));

    return items;
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
