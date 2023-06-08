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

const BASE_URL = "https://www.gerlinger.de";

const SELECTORS = {
  item: ".cms-listing-col.fl-product",
  itemLink: ".product-box__main-link",
  itemImage: ".product-image-wrapper img",
  itemPriceCurrent: ".product-price",
  itemPriceOld: ".list-price",
  itemDiscount: ".badge-discount",
};

const MAX_PRODUCTS = 350;

class AngelweltGerlingerSale extends DealsScraper {
  skipProductPageScraping = true;

  constructor() {
    super({
      referer: BASE_URL,
      origin: BASE_URL,
    });
  }

  async hookListPagePaginatedURL(url, currentPage, allProducts) {
    return allProducts.length < MAX_PRODUCTS
      ? url.replace(/page=[0-9]/, `page=${currentPage}`)
      : false;
  }

  async scrapeListPage(currentURL) {
    console.info("Fetching list page contents");

    const responseText = await fetch(currentURL).then((res) => res.text());
    const html = responseText
      .replace(/(^callback\("\s*|\\n+|\s*"\)$)/g, "")
      .replace(/\\"/g, '"')
      .replace(/\\[/]/g, "/");
    const { document } = new JSDOM(html).window;

    const items = Array.from(document.querySelectorAll(SELECTORS.item)).map(
      this.extractProductData.bind(this)
    );

    return items;
  }

  /**
   * @param {Element} element
   */
  extractProductData(element) {
    const link = element.querySelector(SELECTORS.itemLink);
    const title = link?.getAttribute("data-fl-item-name")?.trim() || "";
    const url = link?.getAttribute("href") || "";
    const image =
      element.querySelector(SELECTORS.itemImage)?.getAttribute("src") || "";

    const priceCurrentElement = element.querySelector(
      SELECTORS.itemPriceCurrent
    )?.childNodes[0];
    const priceCurrentText = priceCurrentElement
      ? priceCurrentElement.textContent?.trim() || ""
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

    console.log("initialProductsData", initialProductsData);

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

new AngelweltGerlingerSale().start();
