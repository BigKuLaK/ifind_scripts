const DealsScraper = require("../../../helpers/deals-scraper");
const { default: fetch } = require("node-fetch");

/**
 * @typedef {import("../../../helpers/deals-scraper").DealData} DealData
 * @typedef {import("../../../helpers/deals-scraper").DealTypeMeta} DealTypeMeta
 * @typedef {import("../../../config/typedefs/product").Product} Product
 * @typedef {import('puppeteer').Page} Page
 */

const BASE_URL = "https://www.docmorris.de";

const MAX_PRODUCTS = 350;

class DocMorrisSale extends DealsScraper {
  skipProductPageScraping = true;

  constructor() {
    super({
      referer: BASE_URL,
      origin: BASE_URL,
    });
  }

  async hookListPagePaginatedURL(baseURL, currentPage, allProducts = []) {
    return allProducts.length < MAX_PRODUCTS
      ? baseURL.replace(/(?<=page=)[0-9]+/, currentPage)
      : false;
  }

  async scrapeListPage(listPageURL) {
    const { records: rawProducts } = await fetch(listPageURL)
      .then((res) => res.json())
      .catch((err) => console.error(err));

    // Extract deal products data
    return rawProducts.map(({ name, url, images, prices }) => {
      const formats = (
        images[0].variants[140] ||
        images[0].variants[100] ||
        images[0].variants[Object.keys(images[0].variants)[0]]
      ).formats;

      // Get product image
      const image = (formats.jpg || formats.webp).resolutions["2x"].url;

      return {
        url: BASE_URL + url,
        title: name,
        image,
        priceCurrent: prices.salesPrice?.value || 0,
        priceOld: prices.recommendedRetailPrice?.value || 0,
        discount: Number(prices.savingsPercentageFormatted.replace("%", "")),
      };
    });
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

new DocMorrisSale().start();
