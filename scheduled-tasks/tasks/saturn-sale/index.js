const DealsScraper = require("../../../helpers/deals-scraper");
const { swapDotAndComma } = require("../../../ifind-utilities/currency");

/**
 * @typedef {import("../../../helpers/deals-scraper").DealData} DealData
 * @typedef {import("../../../helpers/deals-scraper").DealTypeMeta} DealTypeMeta
 * @typedef {import("../../../config/typedefs/product").Product} Product
 * @typedef {import('puppeteer').Page} Page
 */

const BASE_URL = "https://www.saturn.de";

const SELECTORS = {
  list: `[data-test="mms-campaigns-productGrid"]`,
  cardsContainer: `[class*="ProductGrid-styled__StyledRow"]`,
  loadMore: `[data-test="mms-load-more-btn"]`,
  item: `[data-test="mms-campaigns-productGrid-product"]`,
  itemTitle: `[data-test="product-title"]`,
  itemLink: `[data-test="mms-router-link"]`,
  itemImage: `[data-test="product-image"] img`,
  //   itemPriceCurrent: ".find_tile__retailPrice",
  //   itemPriceOld: ".find_tile__previousPrice",
  //   itemDiscount: ".find_tile__discount",
};

class SaturnSale extends DealsScraper {
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
    await page.waitForSelector(SELECTORS.item);
  }

  /** @inheritdoc */
  async hookEvaluateListPageParams() {
    return [SELECTORS];
  }

  /**
   * @param {typeof SELECTORS} SELECTORS
   */
  async hookEvaluateListPage(SELECTORS) {
    const itemSelector = SELECTORS.item;

    const gridContainer = /**@type {HTMLElement} */ (
      document.querySelector(SELECTORS.list)
    );
    const loadMore = /**@type {HTMLElement} */ (
      document.querySelector(SELECTORS.loadMore)
    );

    if (gridContainer.contains(loadMore)) {
      await new Promise((res) => {
        let loadingMore = false;
        let loadMoreTriggered = false;

        const obs = new MutationObserver(() => {
          loadingMore = gridContainer.querySelector(
            `${itemSelector} + :not(${itemSelector})`
          )
            ? true
            : false;

          if (!loadingMore) {
            console.log("no more loding children");

            if (gridContainer.contains(loadMore)) {
              if (!loadMoreTriggered) {
                loadMoreTriggered = true;
                console.log("loading more");
                loadMore.click();

                setTimeout(() => {
                  loadMoreTriggered = false;
                }, 300);
              }
            } else {
              // All products loaded
              res(null);
            }
          }
        });

        obs.observe(gridContainer, { subtree: true, attributes: true });

        loadMore.click();
      });
    }

    // Extract products data
    const cardsContainer = /**@type {HTMLElement}*/ (
      gridContainer.querySelector(SELECTORS.cardsContainer)
    );
    const matchedReactDataProp = /**@type {string}*/ (
      Object.getOwnPropertyNames(cardsContainer).find((propName) =>
        /__reactFiber/i.test(propName)
      )
    );
    const reactData = /**@type {HTMLElement}*/ (
      cardsContainer[matchedReactDataProp]
    );

    const products = reactData.child.memoizedProps;

    return products.map(({ props: { product } }) => {
      const title = product.title;
      const url = product.url;
      const image = product.titleImageUrl;
      const priceCurrent = product.price.price.price;
      const priceOld = product.price.price.strikePrice || null;
      const discount =
        priceCurrent !== priceOld && priceOld
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
    });
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

new SaturnSale().start();
