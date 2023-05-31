const DealsScraper = require("../../../helpers/deals-scraper");
const { default: fetch } = require("node-fetch");

/**
 * @typedef {import("../../../helpers/deals-scraper").DealData} DealData
 * @typedef {import("../../../helpers/deals-scraper").DealTypeMeta} DealTypeMeta
 * @typedef {import("../../../config/typedefs/product").Product} Product
 * @typedef {import('puppeteer').Page} Page
 */

const BASE_URL = "https://www.tom-tailor.de";

const SELECTORS = {
  pagination: ".pagination__button",
  item: ".product-tile",
  itemLink: "a",
  itemTitle: ".product-tile__h5",
  itemImage: ".product-tile__img--main",
  itemPriceCurrent: ".product-tile__price--sale",
  itemPriceOld: ".product-tile__price--dashed",
  itemDiscount: ".product-tile__flags .flag--danger .flag__text",
};

const MAX_PRODUCTS = 80;

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

  /**
   * @param {typeof SELECTORS} SELECTORS
   */
  hookEvaluateListPage(SELECTORS) {
    const productItems = Array.from(document.querySelectorAll(SELECTORS.item));

    const productsData = productItems.map((itemElement) => {
      const link = /**@type {HTMLAnchorElement} */ (
        itemElement.querySelector(SELECTORS.itemLink)
      );
      const title = /**@type {HTMLElement} */ (
        itemElement.querySelector(SELECTORS.itemTitle)
      );
      const image = /**@type {HTMLImageElement} */ (
        itemElement.querySelector(SELECTORS.itemImage)
      );
      const priceCurrent = /**@type {HTMLElement} */ (
        itemElement.querySelector(SELECTORS.itemPriceCurrent)
      );
      const priceOld = /**@type {HTMLElement} */ (
        itemElement.querySelector(SELECTORS.itemPriceOld)
      );
      const discount = /**@type {HTMLElement} */ (
        itemElement.querySelector(SELECTORS.itemDiscount)
      );

      const swapCommaAndDecimal = (match) => (/[. ]/.test(match) ? "," : ".");

      return {
        url: link.href,
        title: title.textContent?.trim() || link.title,
        image: image.src,
        priceCurrent: Number(
          (priceCurrent.textContent || "")
            .replace(/[^., 0-9]+/g, "")
            .trim()
            .replace(/[. ,]/gi, swapCommaAndDecimal)
        ),
        priceOld: Number(
          (priceOld.textContent || "")
            .replace(/[^., 0-9]+/g, "")
            .trim()
            .replace(/[. ,]/gi, swapCommaAndDecimal)
        ),
        discount: Number((discount.textContent || "").replace(/[^0-9]+/g, "")),
        price_current: priceCurrent.textContent,
        price_old: priceOld.textContent,
        discount_text: discount.textContent,
      };
    });

    return productsData;
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
