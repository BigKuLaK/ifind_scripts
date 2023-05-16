const DealsScraper = require("../../../helpers/deals-scraper");
const { addURLParams } = require("../../../helpers/url");

/**
 * @typedef {import("../../../helpers/deals-scraper").DealData} DealData
 * @typedef {import("../../../helpers/deals-scraper").DealTypeMeta} DealTypeMeta
 * @typedef {import("../../../config/typedefs/product").Product} Product
 * @typedef {import('puppeteer').Page} Page
 */

const BASE_URL = "https://www.adidas.de";
const MAX_PAGE = 7;

class AdidasSale extends DealsScraper {
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

  async hookListPagePaginatedURL(url, currentPage) {
    return currentPage <= MAX_PAGE
      ? addURLParams(url, { start: (currentPage - 1) * 48 })
      : false;
  }

  async hookEvaluateListPage() {
    const jsonText = document.body.innerText.trim();
    const data = JSON.parse(jsonText);

    return data.raw.itemList.items.map(
      ({ displayName, image, price, salePrice, salePercentage, link }) => ({
        url: link,
        title: displayName,
        image: image.src,
        priceCurrent: price !== salePrice ? salePrice : price,
        priceOld: price,
        discount: Number(salePercentage?.trim().slice(0, -1) || "0"),
      })
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

new AdidasSale().start();
