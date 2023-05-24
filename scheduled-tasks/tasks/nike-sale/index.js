const DealsScraper = require("../../../helpers/deals-scraper");
const { addURLParams } = require("../../../helpers/url");
const { default: fetch } = require("node-fetch");

/**
 * @typedef {import("../../../helpers/deals-scraper").DealData} DealData
 * @typedef {import("../../../helpers/deals-scraper").DealTypeMeta} DealTypeMeta
 * @typedef {import("../../../config/typedefs/product").Product} Product
 * @typedef {import('puppeteer').Page} Page
 */

const BASE_URL = "https://www.nike.com";
const PRODUCTS_PER_PAGE = 60;
const MAX_PAGE = 5;

class NikeSale extends DealsScraper {
  skipProductPageScraping = true;

  constructor() {
    super({
      referer: BASE_URL,
      origin: BASE_URL,
    });
  }

  async hookListPagePaginatedURL(url, currentPage) {
    return currentPage <= MAX_PAGE
      ? url
          .replace(
            /anchor=[0-9]+/g,
            `anchor=${(currentPage - 1) * PRODUCTS_PER_PAGE}`
          )
          .replace(/count=[0-9]+/g, `count=${PRODUCTS_PER_PAGE}`)
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

    return data.objects.map(({ productInfo: [info] }) => ({
      title: info.productContent.subtitle,
      image: info.imageUrls.productImageUrl,
      url: `${BASE_URL}/de/t/${info.productContent.slug}/${info.merchProduct.styleColor}`,
      priceCurrent: info.merchPrice.currentPrice,
      priceOld: info.merchPrice.fullPrice,
      discount:
        info.merchPrice.currentPrice !== info.merchPrice.fullPrice
          ? (100 * (info.merchPrice.fullPrice - info.merchPrice.currentPrice)) /
            info.merchPrice.fullPrice
          : null,
    }));
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

new NikeSale().start();
