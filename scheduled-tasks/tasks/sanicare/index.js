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

const BASE_URL = "hhttps://www.sanicare.de";

const MAX_PRODUCTS = 350;

const SELECTORS = {
  item: ".product--box",
  itemLink: `.product--title`,
  itemPriceCurrent: `.price--default`,
  itemPriceOld: ".price--discount",
  itemImage: ".image--media img",
};

class Sanicare extends DealsScraper {
  skipProductPageScraping = true;

  constructor() {
    super({
      referer: BASE_URL,
      origin: BASE_URL,
    });
  }

  async hookListPagePaginatedURL(url, currentPage, allProducts) {
    return allProducts.length < MAX_PRODUCTS
      ? url.replace(/(?<=p=)[0-9]/, currentPage)
      : false;
  }

  async scrapeListPage(currentURL) {
    const { listing } = await fetch(currentURL).then((res) => res.json());

    const { document } = new JSDOM(listing).window;

    const items = Array.from(
      document.querySelectorAll(SELECTORS.item) || []
    ).map(this.extractProductData.bind(this));

    return items;
  }

  /**
   * @param {Element} element
   */
  extractProductData(element) {
    const link = element.querySelector(SELECTORS.itemLink);
    const title = link?.textContent?.trim() || "";
    const url = link?.getAttribute("href") || "";
    const imageElement = element.querySelector(SELECTORS.itemImage);
    const image =
      (imageElement?.getAttribute("data-srcset")?.match(/[^\s]+\.(jpg|png)/i) ||
        [])[0] || BASE_URL + imageElement?.getAttribute("src");

    const priceCurrentElement = element.querySelector(
      SELECTORS.itemPriceCurrent
    );
    console.log("price current", priceCurrentElement?.textContent?.trim());
    const priceCurrent =
      Number(
        swapDotAndComma(
          priceCurrentElement?.textContent?.trim().replace(/[^0-9.,]+/, "") ||
            "0"
        )
      ) || null;
    const priceOld =
      Number(
        swapDotAndComma(
          element
            .querySelector(SELECTORS.itemPriceOld)
            ?.textContent?.trim()
            .replace(/[^0-9.,]+/, "") || "0"
        )
      ) || null;
    const discount =
      priceCurrent && priceOld && priceOld !== priceCurrent
        ? ((priceOld - priceCurrent) / priceOld) * 100
        : null;

    return {
      title,
      url,
      image,
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

new Sanicare().start();
