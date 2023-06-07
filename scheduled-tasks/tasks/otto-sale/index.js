const DealsScraper = require("../../../helpers/deals-scraper");
const { swapDotAndComma } = require("../../../ifind-utilities/currency");
const { addURLParams } = require("../../../helpers/url");

/**
 * @typedef {import("../../../helpers/deals-scraper").DealData} DealData
 * @typedef {import("../../../helpers/deals-scraper").DealTypeMeta} DealTypeMeta
 * @typedef {import("../../../config/typedefs/product").Product} Product
 * @typedef {import('puppeteer').Page} Page
 */

const BASE_URL = "https://www.otto.de";
const MAX_PAGE = 2;
const PRODUCTS_PER_PAGE = 120;

const SELECTORS = {
  list: "#reptile-search-result",
  item: "#reptile-tilelist article.product",
  itemTitle: ".find_tile__name",
  itemLink: ".find_tile__productLink",
  itemPriceCurrent: ".find_tile__retailPrice",
  itemPriceOld: ".find_tile__previousPrice",
  itemDiscount: ".find_tile__discount",
  itemImage: "img.find_tile__productImage",
};

class OttoSale extends DealsScraper {
  maxProducts = 300;

  constructor() {
    super({
      referer: BASE_URL,
      origin: BASE_URL,
    });
  }

  async hookListPagePaginatedURL(currentURL, currentPage) {
    // For the children entertainment deals, there's no need for pagination
    if (!/(o=[0-9]+)/i.test(currentURL)) {
      return currentPage === 1 ? currentURL : false;
    }

    return currentPage <= MAX_PAGE
      ? addURLParams(currentURL, { o: PRODUCTS_PER_PAGE * (currentPage - 1) })
      : false;
  }

  /**
   *
   * @param {Page} page
   */
  async hookPreScrapeListPage(page) {
    await page.waitForSelector(SELECTORS.list);
  }

  /** @inheritdoc */
  async hookEvaluateListPageParams() {
    return [SELECTORS];
  }

  async hookEvaluateProductPageParams() {
    return [SELECTORS];
  }

  /**
   * @param {typeof SELECTORS} SELECTORS
   */
  async hookEvaluateListPage(SELECTORS) {
    const list = document.querySelector(SELECTORS.list);

    return JSON.parse(list?.getAttribute("data-ts-feature") || "[]")
      .filter(({ name }) => name === "tile")
      .map(({ variationId }) => ({
        url: `https://www.otto.de/crocotile/tile/${variationId}`, // Temporary URL
      }));
  }

  async hookPreScrapeProductPage(page) {
    await page.waitForSelector(SELECTORS.itemImage);
  }

  async hookEvaluateProductPage(SELECTORS) {
    const title =
      document.querySelector(SELECTORS.itemTitle)?.textContent?.trim() || "";
    const url =
      document
        .querySelector(SELECTORS.itemLink)
        ?.getAttribute("href")
        ?.trim() || "";
    const image =
      document.querySelector(SELECTORS.itemImage)?.getAttribute("src") || "";
    const priceCurrentElement = document.querySelector(
      SELECTORS.itemPriceCurrent
    );
    const priceOldElement = document.querySelector(SELECTORS.itemPriceOld);
    const discount = Number(
      (
        document.querySelector(SELECTORS.itemDiscount)?.textContent?.trim() ||
        "0"
      ).replace(/[^0-9,.]/g, "")
    );

    const priceCurrent = priceCurrentElement?.textContent?.replace(
      /[^0-9,. ]/g,
      ""
    );
    const priceOld =
      priceOldElement?.textContent?.replace(/[^0-9,. ]/g, "") || priceCurrent;

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
            price: Number(
              swapDotAndComma(
                /**@type {string}*/ (
                  /**@type {unknown}*/ (dealData.priceCurrent)
                )
              ).replace(/,/, "")
            ),
            url: BASE_URL + dealData.url,
            price_original: Number(
              swapDotAndComma(
                /**@type {string}*/ (/**@type {unknown}*/ (dealData.priceOld))
              ).replace(/,/, "")
            ),
            discount_percent: dealData.discount,
          },
        ],
      });
    }

    return normalizedProductsData;
  }
}

new OttoSale().start();
