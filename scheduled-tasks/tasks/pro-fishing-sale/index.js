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

const BASE_URL = "https://pro-fishing.de";

const MAX_PRODUCTS = 350;

const SELECTORS = {
  list: ".product-list",
  itemLink: ".productbox-images a",
  itemTitle: ".productbox-title",
  itemImage: ".productbox-image img",
  itemPriceCurrent: `.special-price + [itemprop="price"]`,
  itemPriceOld: ".old-price",
  itemDiscount: ".productbox-ribbon",
};

class ProFishingSale extends DealsScraper {
  skipProductPageScraping = true;

  constructor() {
    super({
      referer: BASE_URL,
      origin: BASE_URL,
    });
  }

  async hookListPagePaginatedURL(url, currentPage, allProducts) {
    return allProducts.length < MAX_PRODUCTS
      ? url.replace(/(?<=_s)[0-9]/, currentPage)
      : false;
  }

  async scrapeListPage(currentURL) {
    const html = await fetch(currentURL).then((res) => res.text());

    const { document } = new JSDOM(html).window;

    const list = document.querySelector(SELECTORS.list);
    const items = Array.from(list?.children || []).map(
      this.extractProductData.bind(this)
    );

    return items;
  }

  /**
   * @param {Element} element
   */
  extractProductData(element) {
    const link = element.querySelector(SELECTORS.itemLink);
    const title =
      element.querySelector(SELECTORS.itemTitle)?.textContent?.trim() || "";
    const url = link?.getAttribute("href") || "";
    const image =
      element.querySelector(SELECTORS.itemImage)?.getAttribute("src") || "";

    const priceCurrentElement = element.querySelector(
      SELECTORS.itemPriceCurrent
    );
    const priceCurrentText = priceCurrentElement
      ? priceCurrentElement.getAttribute("content")?.trim() || ""
      : "";
    const priceOldText =
      element.querySelector(SELECTORS.itemPriceOld)?.textContent?.trim() || "";
    const discountText =
      element.querySelector(SELECTORS.itemDiscount)?.textContent?.trim() || "";

    const priceCurrent = (priceCurrentText?.match(/[0-9,.]+/) || [])[0] || "";
    const priceOld = (priceOldText?.match(/[0-9,.]+/) || [])[0] || "";
    const discount = (discountText?.match(/[0-9.]+/) || [])[0] || null;

    return {
      title,
      url,
      image,
      priceCurrent: priceCurrent ? Number(priceCurrent) : null,
      priceOld: discount ? Number(swapDotAndComma(priceOld)) : null,
      discount: priceCurrent && discount ? Number(discount) : null,
    };
  }

  hookProcessListPageProducts(currentPageProducts) {
    // Some products don't have price, remove them
    return currentPageProducts.filter(({ priceCurrent }) => priceCurrent);
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

new ProFishingSale().start();
