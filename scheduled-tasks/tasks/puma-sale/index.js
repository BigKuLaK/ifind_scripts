const DealsScraper = require("../../../helpers/deals-scraper");

/**
 * @typedef {import("../../../helpers/deals-scraper").DealData} DealData
 * @typedef {import("../../../helpers/deals-scraper").DealTypeMeta} DealTypeMeta
 * @typedef {import("../../../config/typedefs/product").Product} Product
 * @typedef {import('puppeteer').Page} Page
 */

const BASE_URL = "https://eu.puma.com/";

class PumaSale extends DealsScraper {
  skipProductPageScraping = true;

  constructor() {
    super({
      referer: BASE_URL,
      origin: BASE_URL,
    });
  }

  async hookPreScrapeListPage() {
    // void
  }

  async hookEvaluateListPageParams() {
    return [];
  }

  async hookEvaluateListPage() {
    const dummyDiv = document.createElement("div");
    const innerHTML = document.body.innerHTML.trim();
    const dataMatches = innerHTML.match(/(?<=data-puma-analytics=")[^"]+/gi);

    return (
      dataMatches
        ?.map(
          (dataMatch) =>
            JSON.parse(
              Object.assign(dummyDiv, { innerHTML: dataMatch }).textContent ||
                "false"
            )?.products
        )
        .filter(Boolean)
        .map(([{ imageURL, localName, price, productID, promos }]) => ({
          title: localName,
          image: imageURL,
          url: `de/de/pd/${productID.split("_")[0]}`,
          priceCurrent: price,
          priceOld: promos[0].amount + price,
          discount: (promos[0].amount / (promos[0].amount + price)) * 100,
        })) || []
    );
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
            url: BASE_URL + dealData.url,
            price_original: dealData.priceOld,
            discount_percent: dealData.discount,
          },
        ],
      });
    }

    return normalizedProductsData;
  }
}

new PumaSale().start();
