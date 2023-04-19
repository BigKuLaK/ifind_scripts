const DealsScraper = require("../../../helpers/deals-scraper");
const { swapDotAndComma } = require("../../../ifind-utilities/currency");
const { addURLParams } = require("../../../helpers/url");

/**
 * @typedef {import("../../../helpers/deals-scraper").DealData} DealData
 * @typedef {import("../../../helpers/deals-scraper").DealTypeMeta} DealTypeMeta
 * @typedef {import("../../../config/typedefs/product").Product} Product
 * @typedef {import('puppeteer').Page} Page
 */

const BASE_URL = "https://www.mediamarkt.de";

const SELECTORS = {
  list: `[data-test="mms-campaigns-productGrid"]`,
  item: `[data-test="mms-campaigns-productGrid-product"]`,
};

class MediaMarktHighlights extends DealsScraper {
  skipProductPageScraping = true;

  constructor() {
    super({
      referer: BASE_URL,
      origin: BASE_URL,
    });
  }

  /**
   *
   * @param {Page} page
   */
  async hookPreScrapeListPage(page) {
    await page.waitForSelector(SELECTORS.list);

    console.info("Loading all products".cyan);
    await page.evaluate(this.loadAllProducts, SELECTORS);
  }

  /** @inheritdoc */
  async hookEvaluateListPageParams() {
    return [SELECTORS];
  }

  async hookEvaluateProductPageParams() {
    return [SELECTORS];
  }

  async loadAllProducts(SELECTORS) {
    await Promise.all(
      Array.from(document.querySelectorAll(SELECTORS.list)).map(
        async (list) =>
          new Promise((resolve) => {
            const button = list.querySelector(
              `[data-test="mms-load-more-btn"]`
            );
            let loadMoreTriggered = false;

            if (!button) {
              resolve(null);
            }

            const obs = new window.MutationObserver(() => {
              const isButtonEnabled = button && !button.disabled;
              const loadingItems = list.querySelector(
                `[data-test="mms-campaigns-productGrid-product"] + :not([data-test])`
              );
              const isButtonVisible = list.contains(button);
              const hasLoadingItems = loadingItems?.length;

              if (!isButtonVisible) {
                obs.disconnect();
                resolve(null);
                return;
              }

              const isLoading = hasLoadingItems || !isButtonEnabled;

              if (isLoading) {
                loadMoreTriggered = false;
                return;
              }

              if (!loadMoreTriggered) {
                console.log("will click");
                loadMoreTriggered = true;
                setTimeout(() => {
                  button.click();
                }, 500);
              }
            });

            obs.observe(list, {
              attributes: true,
              childList: true,
              subtree: true,
            });

            button.click();
          })
      )
    );
  }

  /**
   * @param {typeof SELECTORS} SELECTORS
   */
  async hookEvaluateListPage(SELECTORS) {
    const lists = Array.from(document.querySelectorAll(SELECTORS.list));

    // Map products by URL to prevent duplicates
    const products = {};

    await Promise.all(
      lists.map(async (list) => {
        const items = list.querySelectorAll(SELECTORS.item);
        items.forEach((item) => {
          // Extract react props
          const reactProp = Object.getOwnPropertyNames(item).find((prop) =>
            /__reactProps/.test(prop)
          );
          const reactProductData =
            item[reactProp].children.props.children.props.product;
          const priceCurrent = reactProductData.price.price.price;
          const priceOld =
            reactProductData.price.price.strikePrice || priceCurrent;

          if (!(reactProductData.url in products)) {
            products[reactProductData.url] = {
              priceCurrent,
              priceOld: priceCurrent !== priceOld ? priceOld : null,
              title: reactProductData.title,
              url: reactProductData.url,
              image: reactProductData.productImage,
              discount:
                priceCurrent !== priceOld
                  ? ((priceOld - priceCurrent) / priceOld) * 100
                  : null,
            };
          }
        });
      })
    );

    return Object.values(products);
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
            url: BASE_URL + dealData.url,
            price_original: dealData.priceOld,
            discount_percent: dealData.discount,
          },
        ],
      });
    }

    return normalizedProductsData;
  }
}

new MediaMarktHighlights().start();
