const DealsScraper = require("../../../helpers/deals-scraper");
const { swapDotAndComma } = require("../../../ifind-utilities/currency");
const cheerio = require("cheerio");
const { default: fetch } = require("node-fetch");

/**
 * @typedef {import("../../../helpers/deals-scraper").DealData} DealData
 * @typedef {import("../../../helpers/deals-scraper").DealTypeMeta} DealTypeMeta
 * @typedef {import("../../../config/typedefs/product").Product} Product
 * @typedef {import('puppeteer').Page} Page
 * @typedef {import('cheerio').Cheerio} Cheerio
 * @typedef {import('cheerio').Element} CheerioElement
 */

const BASE_URL = "https://www.angelsport.de/";

const SELECTORS = {
  list: ".row.articles",
  item: ".product",
  itemTitle: ".title",
  itemImage: ".image img",
  itemLink: ".image a",
  itemPriceCurrent: ".lastprice .newprice",
  itemPriceOld: ".lastprice .wrongprice",
  itemDiscount: ".reduced",
};

const MAX_PRODUCTS = 350;

class ZooroyalSale extends DealsScraper {
  skipProductPageScraping = true;

  constructor() {
    super({
      referer: BASE_URL,
      origin: BASE_URL,
    });
  }

  async hookListPagePaginatedURL(url, currentPage, allProducts) {
    return allProducts.length < MAX_PRODUCTS
      ? url.trim("/") + "/" + currentPage
      : false;
  }

  async scrapeListPage(currentURL) {
    const html = await fetch(currentURL).then((res) => res.text());
    const $ = cheerio.load(html);

    const $list = $(SELECTORS.list);
    const items = $list
      .find(SELECTORS.item)
      .toArray()
      .map((item) => this.extractProductData($(item)));

    return items;
  }

  /**
   * @param {import('cheerio').Cheerio<CheerioElement>} $element
   */
  extractProductData($element) {
    const title =
      $element.find(SELECTORS.itemTitle).first().text().trim() || "";
    const image = $element.find(SELECTORS.itemImage).first().attr("src") || "";
    const url = $element.find(SELECTORS.itemLink).first().attr("href") || "";

    const priceCurrentText =
      $element.find(SELECTORS.itemPriceCurrent).first().text().trim() || "";
    const priceOldText =
      $element.find(SELECTORS.itemPriceOld).first().text().trim() || "";
    const discountText =
      $element.find(SELECTORS.itemDiscount).first().text().trim() || "";

    const priceCurrent = (priceCurrentText?.match(/[0-9,.]+/) || [])[0] || "";
    const priceOld = (priceOldText?.match(/[0-9,.]+/) || [])[0] || "";
    const discount = (discountText?.match(/[0-9.]+/) || [])[0] || null;

    return {
      title,
      url,
      image,
      priceCurrent: priceCurrent ? Number(swapDotAndComma(priceCurrent)) : 0,
      priceOld: discount ? Number(swapDotAndComma(priceOld)) : 0,
      discount: discount ? Number(discount) : 0,
    };
  }

  /**
   * @param {DealData[]} initialProductsData
   * @param {DealTypeMeta} dealType
   */
  async hookNormalizeProductsData(initialProductsData, dealType) {
    /**@type {Product[]} */
    const normalizedProductsData = [];

    for (let dealData of initialProductsData) {
      if (!dealData.url) {
        console.log("No URL:", dealData.title);
        continue;
      }

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

new ZooroyalSale().start();
