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

const BASE_URL = "https://www.medikamente-per-klick.de";

const MAX_PRODUCTS = 350;

const SELECTORS = {
  list: ".productsList.list",
  item: ".boxProduct",
  itemLink: `[itemprop="url"]`,
  itemImage: `[itemprop="image"]`,
  itemPriceCurrent: `.lowPrice`,
  itemPriceOld: ".highPrice",
};

class MedikamentePerClick extends DealsScraper {
  skipProductPageScraping = true;

  constructor() {
    super({
      referer: BASE_URL,
      origin: BASE_URL,
    });
  }

  async hookListPagePaginatedURL(url, currentPage, allProducts) {
    return allProducts.length < MAX_PRODUCTS
      ? url.replace(/(?<=VIEW_INDEX=)[0-9]/, currentPage)
      : false;
  }

  async scrapeListPage(currentURL) {
    const html = await fetch(currentURL).then((res) => res.text());

    const { document } = new JSDOM(html).window;

    const list = document.querySelector(SELECTORS.list);

    const items = Array.from(list?.querySelectorAll(SELECTORS.item) || []).map(
      this.extractProductData.bind(this)
    );

    return items;
  }

  /**
   * @param {Element} element
   */
  extractProductData(element) {
    const link = element.querySelector(SELECTORS.itemLink);
    const title = link?.textContent?.trim() || "";
    const url = link?.getAttribute("href") || "";
    const image = (
      element.querySelector(SELECTORS.itemImage)?.getAttribute("src") || ""
    )
      .replace("klein", "gross")
      .replace("_k", "_g");

    const priceCurrentElement = element.querySelector(
      SELECTORS.itemPriceCurrent
    );
    const priceCurrent =
      Number(
        swapDotAndComma(priceCurrentElement?.textContent?.trim() || "0")
      ) || null;
    const priceOld =
      Number(
        swapDotAndComma(
          element.querySelector(SELECTORS.itemPriceOld)?.textContent?.trim() ||
            "0"
        )
      ) || null;
    const discount =
      priceCurrent && priceOld && priceOld !== priceCurrent
        ? ((priceOld - priceCurrent) / priceOld) * 100
        : null;

    return {
      title,
      url,
      image: image ? BASE_URL + image : "",
      priceCurrent,
      priceOld,
      discount,
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

new MedikamentePerClick().start();
