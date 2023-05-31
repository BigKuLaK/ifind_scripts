require("colors");
const pause = require("../pause");
const createTorProxy = require("../tor-proxy");
const { addDealsProducts } = require("../main-server/products");
const { prerender } = require("../main-server/prerender");
const { saveLastRunFromProducts } = require("../../scheduled-tasks/utils/task");

/**
 * USAGE NOTES
 * - Functions tagged as HOOK can be overriden on extending class.
 * - Functions taggged as HELPER are not allowed to be overriden on extending class.
 */

/**
 * Type defs
 * @typedef {object} DealData
 * @property {string} url
 * @property {string} title
 * @property {string} image
 * @property {number} priceCurrent
 * @property {number} [priceOld]
 * @property {number} [discount]
 * @property {number} [availabilityPercent]
 * @property {number} [dealExpiry]
 *
 * @typedef {import('../../config/typedefs/product').Product} Product
 * @typedef {import('puppeteer').Page} Page
 * @typedef {import('../../scheduled-tasks/lib/Task').DealTypeMeta} DealTypeMeta
 * @typedef {import('../tor-proxy').TorProxyConfig} TorProxyConfig
 */

/**
 * Provides an interface to scrape products details from a website, save these products to Main Server, and trigger a front end prerender
 *
 * @remarks
 *
 * These member function should be overriden on the child class:
 * {@link DealsScraperhookGetInitialProductsData},
 * {@link hookListPagePaginatedURL},
 * {@link hookPreScrapeListPage},
 * {@link hookEvaluateListPageParams},
 * {@link hookEvaluateListPage},
 * {@link hookProcessListPageProducts},
 * {@link hookPreScrapeProductPage},
 * {@link hookEvaluateProductPageParams},
 * {@link hookEvaluateProductPage},
 * {@link hookNormalizeProductsData}, and
 * {@link hookPostPrerender}
 *
 * For development purposes, a number of helper hooks are provided:
 * {@link hookInspectListPageProducts}
 *
 * To override page scraping, such that removing the use of puppeteer,
 * simply implement the method {@link scrapeListPage} on the child class
 */
class DealsScraper {
  /**
   * @type {import('../tor-proxy').TorProxy}
   * @private
   */
  torProxy;

  /**
   * @type {Page}
   * @private
   */
  page;

  /**
   * @type {TorProxyConfig}
   */
  torProxyBrowserConfig;

  /**
   * @abstract
   */
  skipProductPageScraping = false;

  /**
   * @abstract
   */
  navigationTimeout = 60000;

  /**@param {TorProxyConfig} torProxyBrowserConfig */
  constructor(torProxyBrowserConfig) {
    this.torProxyBrowserConfig = torProxyBrowserConfig;
    this.taskData = JSON.parse(/**@type {string}*/ (process.env.taskData));
  }

  /**
   * The entry point call
   */
  async start() {
    console.info("Starting deals scraper.");

    console.info("Getting product deals list.");

    /**
     * Get products list grouped by dealType
     * @type {Record<string, Product[]>}
     */
    const productsByDeals = await this.getProductDeals();

    // Send products for each dealType
    const addedProducts = [];
    for (let [dealType, products] of Object.entries(productsByDeals)) {
      addedProducts.push(...(await addDealsProducts(dealType, products)));
    }

    if (!addedProducts.length) {
      console.info(`[DEALSCRAPER] Skipping prerender due to empty products.`);
    } else {
      // Trigger prerender
      const prerenderData = await prerender();

      // Post prerender hook
      await this.hookPostPrerender(prerenderData, addedProducts);
    }

    console.info("DONE".white.bgGreen);
  }

  /**
   * @returns {Promise<Record<string, Product[]>>}
   * @private
   */
  async getProductDeals() {
    /**
     * Map initial products by dealType
     * @type {Record<string, Product[]>}
     */
    const initialProductsByDeals = {};

    if (!this.taskData.meta.deal_types?.length) {
      console.info(
        `[DEALSCRAPER] Task ${this.taskData.id} has empty deal types. Kindly verify this with your data.`
      );
    }

    // Get initial products for each dealType
    for (let dealType of this.taskData.meta.deal_types) {
      console.info(
        `[DEALSCRAPER] Getting initial products data from deals page for ${dealType.id}.`
      );

      const initialProductsData = await this.hookGetInitialProductsData(
        dealType
      );

      console.info(
        `[DEALSCRAPER] Scraped initial data for ${initialProductsData.length} products.`
      );

      // If child class doesn't need to scrape each product page
      if (!this.skipProductPageScraping) {
        console.info(
          "[DEALSCRAPER] Getting additional products data from each product page."
        );
      }

      const fullDealsData = !this.skipProductPageScraping
        ? await this.getFullProductsData(initialProductsData)
        : /**@type {DealData[]} */ (initialProductsData);

      console.info("[DEALSCRAPER] Normalizing products data.");
      /**@type {Product[]} */
      initialProductsByDeals[dealType.id] =
        await this.hookNormalizeProductsData(fullDealsData, dealType);
    }

    // Close puppeteer page instance
    await this.torProxy?.close();

    return initialProductsByDeals;
  }

  /**
   * HOOK
   *
   * Scrapes basic product data from the deals page
   *
   * Contains a logic to scrape all initial products data
   * on a single or multiple list pages.
   *
   * Normally calls this.{@link scrapeListPage}() in the consuming module
   *
   * @param {DealTypeMeta} dealType
   * @return {Promise<Partial<DealData>[]>}
   * @abstract
   */
  async hookGetInitialProductsData(dealType) {
    console.info(
      `[DEALSCRAPER] Using default hookGetInitialProductsData for deal type ${dealType.id}`
        .gray
    );

    await pause();

    const dealURLs = dealType.url.filter(Boolean);

    if (!dealURLs.length) {
      throw new Error(`Deal type ${dealType.id} is missing the 'url'.`);
    }

    const products = [];

    for (let dealURL of dealURLs) {
      let currentPage = 1;
      let currentPageURL = await this.hookListPagePaginatedURL(
        dealURL,
        currentPage,
        products
      );

      while (currentPageURL) {
        await pause();

        console.info(`[DEALSCRAPER] Scraping page ${currentPage}`);

        const currentPageProducts = await this.scrapeListPage(currentPageURL);

        const processedCurrentPageProducts =
          await this.hookProcessListPageProducts(currentPageProducts, products);

        await this.hookInspectListPageProducts(
          currentPageProducts,
          currentPageURL,
          currentPage
        );

        if (processedCurrentPageProducts.length) {
          products.push(...processedCurrentPageProducts);
          currentPageURL = await this.hookListPagePaginatedURL(
            dealURL,
            ++currentPage,
            products
          );
        } else {
          break;
        }
      }
    }

    return products;
  }

  /**
   * HOOK - A function to run to format URL for each paginated request
   * @param {string} url
   * @param {number} currentPage
   * @param {Partial<DealData>[]} allProducts
   */
  async hookListPagePaginatedURL(url, currentPage, allProducts = []) {
    // By default, expect only a single page
    return currentPage === 1 ? url : false;
  }

  /**
   * HOOK - A function to run when scrapeListPage is called. Called before the actual evaluation of page.
   * @param {Page} page
   * @absract
   */
  async hookPreScrapeListPage(page) {
    /**
     * Normally implements page.waitForSelector()
     */

    /**
     * Show a warning as this parent member should not be called,
     * but should be overriden on the child class instead
     */
    console.warn(
      "hookPreScrapeListPage is not implemented on the child class. This might not be intentional. Kindly revisit your child class implementation."
    );
  }

  /**
   * HOOK
   * A function to call when this.{@link scrapeListPage}() is to be called. Should return an array of additional parameters to be passed into Puppeter.Page.evaluate()
   * @returns {Promise<any[]>}
   * @abstract
   */
  async hookEvaluateListPageParams() {
    console.info(
      "[DEALSCRAPER] hookEvaluateListPageParams is not implemented in the child class. Kindly revisit your implementation if this is intentional."
    );
    return [];
  }

  /**
   * HOOK - A function supplied into Puppeteer.Page.evaluate() when this.scrapeListPage is called
   * @return {Partial<DealData>[]|Promise<Partial<DealData>[]>}
   * @absract
   */
  hookEvaluateListPage(...args) {
    /**
     * Throw an error as this parent member should not be called,
     * but should be overriden on the child class instead
     */
    throw new ReferenceError(
      "hookEvaluateListPage is not implemented on the child class"
    );

    return [];
  }

  /**
   * HOOK - Allows for processing products that are fetched for each page in products listing page
   * @param {Partial<DealData>[]} currentPageProducts
   * @param {Partial<DealData>[]} allProducts
   * @return {Promise<Partial<DealData>[]>}
   * @absract
   */
  async hookProcessListPageProducts(
    currentPageProducts = [],
    allProducts = []
  ) {
    return allProducts;
  }

  /**
   * HOOK
   * A function that is called when this.{@link getFullProductsData}() is called
   * @param {DealData[]} initialProductsData
   * @returns {Promise<DealData[]>}
   * @abstract
   */
  async hookGetFullProductsData(initialProductsData) {
    console.info(
      `[DEALSCRAPER] hookGetFullProductsData is not implemented in the child class. Using default.`
        .gray
    );

    /**@type {DealData[]} */
    const fullProductsData = [];

    const totalProducts = initialProductsData.length;
    let currentProductCount = 1;

    for (let initialProductData of initialProductsData) {
      const formattedCount = String(currentProductCount).padStart(3, " ");

      currentProductCount++;

      if (!initialProductData.url) {
        console.warn(
          `[DEALSCRAPER] Skipping this product since there is no URL present.`,
          initialProductData
        );
        continue;
      }

      /**@type {DealData} */
      const fullProductData = await /**@type {Promise<DealData>} */ (
        this.scrapeProductPage(initialProductData.url)
      );

      if (!fullProductData) {
        continue;
      }

      fullProductsData.push({
        ...initialProductData,
        ...fullProductData,
      });

      console.info(
        `[DEALSCRAPER] ${formattedCount} of ${totalProducts} - Scraped product data for ${fullProductData.title}`
          .green
      );
    }

    return fullProductsData;
  }

  /**
   * HOOK
   * A function to call when this.{@link scrapeProductPage}() is to be called. Should return an array of additional parameters to be passed into Puppeter.Page.evaluate()
   * @abstract
   *
   * @return {Promise<any[]>}
   */
  async hookEvaluateProductPageParams() {
    console.info(
      "[DEALSCRAPER] hookEvaluateProductPageParams is not implemented in the child class. Kindly revisit your implementation if this is intentional."
    );
    return [];
  }

  /**
   * HOOK - A function to run when scrapeProductPage is called. Called before the actual evaluation of page.
   * @param {Page} page
   * @absract
   */
  async hookPreScrapeProductPage(page) {
    /**
     * Normally implements page.waitForSelector()
     */

    /**
     * Show a warning as this parent member should not be called,
     * but should be overriden on the child class instead
     */
    console.warn(
      "hookPreScrapeListPage is not implemented on the child class. This might not be intentional. Kindly revisit your child class implementation."
    );
  }

  /**
   * HOOK
   * A function that passed into Puppeteer.Page.evaluate() when this.{@link scrapeProductPage}() is called.
   * @abstract
   * @returns {Promise<Partial<DealData>>}
   */
  async hookEvaluateProductPage(...evaluateParams) {
    throw new Error(
      "hookEvaluateProductPage is not implemented on the child class while skipProductPageScraping is set to false. Kindly revisit your implementation if this is intentional."
    );
  }

  /**
   * HOOK - A function that normalizes raw data from the deals page to match Product format for the Main Server.
   * @param {DealData[]} initialProductsData
   * @param {DealTypeMeta} dealType
   * @returns {Promise<import('../../config/typedefs/product').Product[]>}
   * @absract
   */
  async hookNormalizeProductsData(initialProductsData, dealType) {
    /**
     * Throw an error as this parent member should not be called,
     * but should be overriden on the child class instead
     */
    throw new ReferenceError(
      "hookNormalizeProductsData is not implemented on the child class"
    );

    return [];
  }

  /**
   * HOOK
   * A function called after the prerender request
   * @param {{ success: boolean, error: string }} prerenderResponseData
   * @param {(Product & { updated_at: string })[]} products
   * @abstract
   */
  async hookPostPrerender(prerenderResponseData, products) {
    console.info("[DEALSCRAPER] Running default postPrerender hook.");
    await saveLastRunFromProducts(process.env.taskRecord, products);
  }

  /**
   * HELPER - Function that initializes the torproxy browser and page
   */
  async initializePage() {
    if (!this.torProxy) {
      this.torProxy = createTorProxy(this.torProxyBrowserConfig);
    }

    if (!this.page) {
      this.page = await this.torProxy.newPage(false);
    }
  }

  /**
   * HELPER - Function that scrapes a given page URL
   * calls hookScraperListPage
   * @param {string} listPageURL
   */
  async scrapeListPage(listPageURL) {
    await this.initializePage();

    let tries = 3;

    while (tries--) {
      try {
        await this.page.goto(listPageURL, {
          timeout: this.navigationTimeout,
        });

        // Pre-scraping processes
        await this.hookPreScrapeListPage(this.page);
        break;
      } catch (err) {
        await this.saveScreenShot();

        console.error(err);
        console.info(
          `[DEALSCRAPER] Unable to get to the list page (${listPageURL}), retrying...`
        );

        // Create a new Tor Browser
        await this.torProxy.launchNewBrowser();
        this.page = await this.torProxy.newPage();

        await pause();
      }
    }

    if (tries <= 0) {
      await this.saveScreenShot();
      throw new Error("[DEALSCRAPER] Unable to get to the list page.");
    }

    /**@type {any[]} evaluateParams Additional params to passe into Puppeteer.Page.evaluate() call */
    const evaluateParams = await this.hookEvaluateListPageParams();

    // Scrape the page
    return await this.page.evaluate(
      this.hookEvaluateListPage,
      ...evaluateParams
    );
  }

  /**
   * TOOL-HOOK - A function that allows inspection of products resulted from the scrapeListPage call
   * @param {Array<Partial<DealData>>} products
   * @param {string} currentPageURL
   * @param {number} currentPage
   */
  async hookInspectListPageProducts(products, currentPageURL, currentPage) {}

  /**
   *
   * @param {string} productURL The URL of the product to scrape
   * @returns {Promise<Partial<DealData>|null>}
   */
  async scrapeProductPage(productURL) {
    await this.initializePage();

    await pause(500);

    console.info(`[DEALSCRAPER] Scraping product page: ${productURL}`.cyan);

    try {
      const page = this.page;
      await page.goto(productURL), { waitUntil: "networkidle0" };

      // Pre-scraping processes
      await this.hookPreScrapeProductPage(page);

      // Get product page evaluate additional params
      /**@type {any[]} */
      const evaluateParams = await this.hookEvaluateProductPageParams();

      // Scrape the page
      const scrapedData = await page.evaluate(
        this.hookEvaluateProductPage,
        ...evaluateParams
      );

      return scrapedData;
    } catch (err) {
      console.warn(err.stack);
      console.info(`Error while scraping product page. Skipping.`);
      return null;
    }
  }

  /**
   * @param {Partial<DealData>[]} initialProductsData - Initial products data
   * @returns {Promise<DealData[]>}
   * @private
   */
  async getFullProductsData(initialProductsData) {
    return await this.hookGetFullProductsData(
      /**@type {DealData[]}*/ (initialProductsData)
    );
  }

  /**
   * Save screenshot
   */
  async saveScreenShot(folderSuffix = "") {
    await this.torProxy.saveScreenShot(folderSuffix);
  }
}

module.exports = DealsScraper;
