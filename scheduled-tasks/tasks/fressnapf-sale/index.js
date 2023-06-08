const DealsScraper = require("../../../helpers/deals-scraper");
const { addURLParams } = require("../../../helpers/url");
const { default: fetch } = require("node-fetch");

/**
 * @typedef {import("../../../helpers/deals-scraper").DealData} DealData
 * @typedef {import("../../../helpers/deals-scraper").DealTypeMeta} DealTypeMeta
 * @typedef {import("../../../config/typedefs/product").Product} Product
 * @typedef {import('puppeteer').Page} Page
 */

const BASE_URL = "https://www.fressnapf.de";
const LIST_PAGE_MAX_PRODUCTS = 500;

class FressnapfSale extends DealsScraper {
  skipProductPageScraping = true;

  constructor() {
    super({
      referer: BASE_URL,
      origin: BASE_URL,
    });
  }

  async hookListPagePaginatedURL(url, currentPage, allProducts) {
    return allProducts.length < LIST_PAGE_MAX_PRODUCTS
      ? addURLParams(url, { currentPage, pageSize: 100 })
      : false;
  }

  async scrapeListPage(currentURL) {
    const { products } = await fetch(currentURL, {
      headers: {
        "Content-Type": "application/json",
      },
    }).then((res) => res.json());

    return products.map(({ name, url, images, pricing }) => ({
      title: name,
      url: BASE_URL + url,
      image:
        images.find(({ imageType }) => imageType === "PRIMARY")?.url ||
        images[0].url,
      priceCurrent: pricing.current.value,
      priceOld: pricing.former?.value || null,
      discount: pricing.savingsRelative?.value || null,
    }));
  }

  async hookProcessInitialProducts(initialProductsData) {
    // Sort products by discount
    initialProductsData.sort((productA, productB) =>
      productA.discount < productB.discount ? -1 : 1
    );

    return initialProductsData;
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

new FressnapfSale().start();
