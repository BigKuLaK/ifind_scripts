const DealsScraper = require("../../../helpers/deals-scraper");
const { default: fetch } = require("node-fetch");
const cheerio = require("cheerio");
require("colors");

/**
 * @typedef {import("../../../helpers/deals-scraper").DealData} DealData
 * @typedef {import("../../../helpers/deals-scraper").DealTypeMeta} DealTypeMeta
 * @typedef {import("../../../config/typedefs/product").Product} Product
 * @typedef {import('puppeteer').Page} Page
 */

const BASE_URL = "https://eu.puma.com";

const SELECTORS = {
  list: ".product-grid",
  item: ".grid-tile",
  itemLink: ".product-tile-image-link",
};

class PumaSale extends DealsScraper {
  skipProductPageScraping = true;

  constructor() {
    super({
      referer: BASE_URL,
      origin: BASE_URL,
    });
  }

  async hookPreScrapeListPage(page) {
    await page.waitForSelector(SELECTORS.list);
  }

  async hookEvaluateListPageParams() {
    return [SELECTORS, BASE_URL];
  }

  async hookEvaluateListPage(SELECTORS, BASE_URL) {
    /**@type {Element} */
    const list = document.querySelector(SELECTORS.list);
    const items = Array.from(list.querySelectorAll(SELECTORS.item));

    return items.map((itemElement) => {
      const itemLink =
        itemElement.querySelector(SELECTORS.itemLink)?.getAttribute("href") ||
        "";
      const {
        products: [itemData],
      } = JSON.parse(itemElement.dataset.pumaAnalytics);

      const discountAmount = itemData.promos?.length
        ? itemData.promos[0].amount || 0
        : 0;
      const priceOld = discountAmount ? itemData.price + discountAmount : 0;
      const discount = discountAmount ? (discountAmount / priceOld) * 100 : 0;

      // styleID: '386172_01',
      // localName: 'Rebound Game Sneakers für Jugendliche',
      // productID: '386172_01',
      // bundle: false,
      // set: false,
      // productName: 'Rebound Game Sneakers für Jugendliche',
      // productCategory: 'Nachhaltige Styles',
      // category: 'collections-lifestyle-sustainability',
      // price: 54.95,
      // quantity: 1,
      // EAN: '4065449465786',
      // UPC: '195102465908',
      // inventory: 'Available',
      // status: '',
      // manuName: '',
      // manuSKU: '',
      // promos: [Array],
      // imageURL: 'https://images.puma.net/images/386172/01/sv01/fnd/EEA/w/600/h/600/',
      // skuID: '4065449465786',
      // inStock: 'true',
      // orderable: 'true',
      // VAT: 0.19,
      // discounted: 'false'

      return {
        title: itemData.productName,
        image: itemData.imageURL,
        priceCurrent: itemData.price,
        priceOld,
        discount,
        url: BASE_URL + itemLink,
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

new PumaSale().start();
