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

const BASE_URL = "https://www.zooplus.de";

const SELECTORS = {
  list: '[data-zta="product-list-wrapper"]',
  item: '[data-zta="product-box-list"]',
  itemLink: `[class*="ProductGridItem-module_productTitleAnchor"]`,
  itemImage: `[class*="ProductGridItem-module_productImage"]`,
  itemPriceCurrent: `.price--default`,
  itemPriceOld: ".price--discount",
};

class ZooPlus extends DealsScraper {
  skipProductPageScraping = true;

  constructor() {
    super({
      referer: BASE_URL,
      origin: BASE_URL,
    });
  }

  async hookEvaluateListPageParams() {
    return [SELECTORS];
  }

  async scrapeListPage(currentURL) {
    const html = await fetch(currentURL).then((res) => res.text());
    const document = new JSDOM(html).window.document;
    const nextData = JSON.parse(
      document.getElementById("__NEXT_DATA__")?.textContent?.trim() || "{}"
    );

    return nextData.props.pageProps.initialZustandStoreState.productsSlice.products.map(
      this.extractProductData.bind(this)
    );
  }

  extractProductData(productData) {
    const title = productData.title;
    const url = BASE_URL + productData.path;
    const image = productData.picture200;
    const priceCurrent = productData.variants[0].price.metaPropPrice;
    const priceOld =
      Number(
        swapDotAndComma(
          (productData.variants[0].price.beforePrice?.match(/[0-9,.]+/) ||
            [])[0] || "0"
        )
      ) || null;
    const discount = priceOld
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

new ZooPlus().start();
