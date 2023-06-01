const DealsScraper = require("../../../helpers/deals-scraper");
const { addURLParams } = require("../../../helpers/url");
const { default: fetch } = require("node-fetch");
const cheerio = require("cheerio");
const { swapDotAndComma } = require("../../../ifind-utilities/currency");

/**
 * @typedef {import("../../../helpers/deals-scraper").DealData} DealData
 * @typedef {import("../../../helpers/deals-scraper").DealTypeMeta} DealTypeMeta
 * @typedef {import("../../../config/typedefs/product").Product} Product
 * @typedef {import('puppeteer').Page} Page
 * @typedef {import('cheerio').AnyNode} AnyNode
 * @typedef {import('cheerio').Cheerio} Cheerio
 */

const BASE_URL = "https://joop.com";
const MAX_PAGE = 3;

const SELECTORS = {
  item: "[data-product]",
  itemTitle: ".productInfo__name",
  itemImage: "img",
  itemLink: "a[href]",
  itemPriceCurrent: ".productInfo__price--sale",
  itemPriceOld: ".productInfo__price--strikethrough",
};

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
      ? addURLParams(url, { page: currentPage - 1 })
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
    const html = await fetch(listPageURL).then((res) => res.text());
    const $ = cheerio.load(html);

    const items = $(SELECTORS.item)
      .toArray()
      .map((item) => this.extractItemData($(item)));

    return items;
  }

  /**
   * @param {import('cheerio').Cheerio<AnyNode>} $item
   */
  extractItemData($item) {
    const title = $item.find(SELECTORS.itemTitle).text().trim();
    const image = BASE_URL + $item.find(SELECTORS.itemImage).attr("src");
    const url = BASE_URL + $item.find(SELECTORS.itemLink).attr("href");
    const priceCurrent = Number(
      swapDotAndComma(
        $item.find(SELECTORS.itemPriceCurrent).text().trim().split(" ")[1]
      )
    );
    const priceOld = Number(
      swapDotAndComma(
        $item.find(SELECTORS.itemPriceOld).text().trim().split(" ")[1]
      )
    );
    const discount =
      priceCurrent !== priceOld
        ? ((priceOld - priceCurrent) / priceOld) * 100
        : 0;

    return {
      title,
      image,
      url,
      priceCurrent,
      priceOld: discount ? priceOld : undefined,
      discount,
    };
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
