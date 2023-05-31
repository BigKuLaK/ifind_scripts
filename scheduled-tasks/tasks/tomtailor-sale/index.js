const DealsScraper = require("../../../helpers/deals-scraper");
const { default: fetch } = require("node-fetch");

/**
 * @typedef {import("../../../helpers/deals-scraper").DealData} DealData
 * @typedef {import("../../../helpers/deals-scraper").DealTypeMeta} DealTypeMeta
 * @typedef {import("../../../config/typedefs/product").Product} Product
 * @typedef {import('puppeteer').Page} Page
 */

const BASE_URL = "https://www.tom-tailor.de";

const MAX_PRODUCTS = 300;

class TomTailorSale extends DealsScraper {
  skipProductPageScraping = true;

  constructor() {
    super({
      referer: BASE_URL,
      origin: BASE_URL,
    });
  }

  async hookListPagePaginatedURL(baseURL, currentPage, allProducts = []) {
    return allProducts.length < MAX_PRODUCTS
      ? baseURL.replace(/(?<=offset%3A)[0-9]+/, (currentPage - 1) * 48)
      : false;
  }

  async scrapeListPage(listPageURL) {
    const pageData = await fetch(listPageURL)
      .then((res) => res.json())
      .catch((err) => console.error(err));

    const rawProducts = pageData.pageProps.data.data.dataSources.__master.items;

    // Extract deal products data
    return rawProducts.map(({ name, url, sizes, ...product }) => {
      // Get product image
      const imagesFlatten = sizes[0].images.flat();
      const imageNumber = Math.min(
        ...imagesFlatten.map(({ number }) => number)
      );
      const imageIndex = imagesFlatten.findIndex(
        ({ number }) => number === imageNumber
      );

      return {
        url: BASE_URL + url,
        title: name,
        image: imagesFlatten[imageIndex].src,
        priceCurrent: sizes[0].discount,
        priceOld: sizes[0].price,
        discount:
          sizes[0].discount === sizes[0].price
            ? null
            : ((sizes[0].price - sizes[0].discount) / sizes[0].price) * 100,
      };
    });
  }

  async hookProcessListPageProducts(currentPageProducts, allProducts) {
    const filteredCurrrentProducts = [];

    // Ensure there's no other items with the same name and prices
    currentPageProducts.forEach((currentPageProduct) => {
      if (
        !allProducts.some(
          (product) =>
            product.priceCurrent === currentPageProduct.priceCurrent &&
            product.priceOld === currentPageProduct.priceOld &&
            product.title === currentPageProduct.title
        ) &&
        !filteredCurrrentProducts.some(
          (product) =>
            product.priceCurrent === currentPageProduct.priceCurrent &&
            product.priceOld === currentPageProduct.priceOld &&
            product.title === currentPageProduct.title
        )
      ) {
        {
          filteredCurrrentProducts.push(currentPageProduct);
        }
      }
    });

    return filteredCurrrentProducts;
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

new TomTailorSale().start();
