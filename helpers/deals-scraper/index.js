const pause = require("../pause");
const createTorProxy = require("../tor-proxy");
const { addDealsProducts } = require("../main-server/products");
const { prerender } = require("../main-server/prerender");

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
 *
 * @typedef {import('../../config/typedefs/product').Product} Product
 */

/**
 * Provides an interface to scrape products details from a website, save these products to Main Server, and trigger a front end prerender
 *
 * @remarks
 *
 * These member function should be overriden on the child class:
 * {@link hookGetInitialProductsData},
 * {@link hookPreScrapeListPage},
 * {@link hookPreScrapeProductPage},
 * {@link hookEvaluateListPageParams},
 * {@link hookEvaluateListPage},
 * {@link hookEvaluateProductPageParams},
 * {@link hookEvaluateProductPage}, and
 * {@link hookNormalizeProductsData}
 */
class DealsScraper {
  /**
   * @type {import('../tor-proxy').TorProxy}
   * @private
   */
  torProxy;

  /**
   * @type {import('puppeteer').Page}
   * @private
   */
  page;

  /**
   * @abstract
   */
  skipProductPageScraping = false;

  /**
   * The dealType ID
   * @absract
   */
  dealType;

  /**@param {import('../tor-proxy').TorProxyConfig} torProxyBrowserConfig */
  constructor(torProxyBrowserConfig) {
    this.torProxy = createTorProxy(torProxyBrowserConfig);
  }

  /**
   * The entry point call
   */
  async start() {
    // Ensure deal type
    if (!this.dealType) {
      throw ReferenceError(
        "Unable to send product data to Main Server. dealType is not implemented in the child class."
      );
    }

    console.info("Starting deals scraper.");

    console.info("Getting product deals list.");
    /**
     * Get products list
     * @type {Product[]}
     */
    const productsList = await this.getProductDeals();

    // Send products by deals
    await addDealsProducts(this.dealType, productsList);

    // Trigger prerender
    await prerender();
  }

  /**
   * @returns {Promise<Product[]>}
   * @private
   */
  async getProductDeals() {
    this.page = await this.torProxy.newPage();

    console.info("Getting initial products data from deals page.");
    const initialProductsData = await this.hookGetInitialProductsData();

    // If child class doesn't need to scrape each product page
    if (this.skipProductPageScraping) {
      console.info("Getting additional products data from each product page.");
    }
    const fullDealsData = !this.skipProductPageScraping
      ? await this.getFullProductsData(initialProductsData)
      : /**@type {DealData[]} */ (initialProductsData);

    console.info("Normalizing products data.");
    /**@type {Product[]} */
    const normalizedProductsData = await this.hookNormalizeProductsData(
      fullDealsData
    );

    // Close puppeteer page instance
    await this.torProxy.close();

    return normalizedProductsData;
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
   * @return {Promise<Partial<DealData>[]>}
   * @abstract
   */
  async hookGetInitialProductsData() {
    /**
     * Throw an error as this parent member should not be called,
     * but should be overriden on the child class instead
     */
    throw new ReferenceError(
      "hookGetInitialProductsData is not implemented on the child class"
    );
  }

  /**
   * HOOK - A function to run when scrapeListPage is called. Called before the actual evaluation of page.
   * @param {import('puppeteer').Page} page
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
   * HOOK - A function to run when scrapeListPage is called. Called before the actual evaluation of page.
   * @param {import('puppeteer').Page} page
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
   * A function to call when this.{@link scrapeListPage}() is to be called. Should return an array of additional parameters to be passed into Puppeter.Page.evaluate()
   * @returns {Promise<any[]>}
   * @abstract
   */
  async hookEvaluateListPageParams() {
    console.info(
      "hookEvaluateListPageParams is not implemented in the child class. Kindly revisit your implementation if this is intentional."
    );
    return [];
  }

  /**
   * HOOK - A function supplied into Puppeteer.Page.evaluate() when this.scrapeListPage is called
   * @return {DealData[]}
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
   * HOOK
   * A function to call when this.{@link scrapeProductPage}() is to be called. Should return an array of additional parameters to be passed into Puppeter.Page.evaluate()
   * @abstract
   */
  async hookEvaluateProductPageParams() {
    console.info(
      "hookEvaluateProductPageParams is not implemented in the child class. Kindly revisit your implementation if this is intentional."
    );
    return [];
  }

  /**
   * HOOK
   * A function that passed into Puppeteer.Page.evaluate() when this.{@link scrapeProductPage}() is called.
   * @abstract
   * @returns {DealData}
   */
  hookEvaluateProductPage(...evaluateParams) {
    throw new Error(
      "hookEvaluateProductPage is not implemented on the child class while skipProductPageScraping is set to false. Kindly revisit your implementation if this is intentional."
    );
  }

  /**
   * HOOK - A function that normalizes raw data from the deals page to match Product format for the Main Server.
   * @param {DealData[]} initialProductsData
   * @returns {Promise<import('../../config/typedefs/product').Product[]>}
   * @absract
   */
  async hookNormalizeProductsData(initialProductsData) {
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
   * HELPER - Function that scrapes a given page URL
   * calls hookScraperListPage
   * @param {string} listPageURL
   */
  async scrapeListPage(listPageURL) {
    const page = this.page;

    let tries = 3;

    while (tries--) {
      try {
        await page.goto(listPageURL);

        // Pre-scraping processes
        await this.hookPreScrapeListPage(page);
      } catch (err) {
        console.error(err);
        console.info("Unable to get to the list page, retrying...");

        // Create a new Tor Browser
        await this.torProxy.launchNewBrowser();
        this.page = await this.torProxy.newPage();

        await pause();
      }
    }

    if (!tries) {
      throw new Error("Unable to get to the list page.");
    }

    /**@type {any[]} evaluateParams Additional params to passe into Puppeteer.Page.evaluate() call */
    const evaluateParams = await this.hookEvaluateListPageParams();

    // Scrape the page
    return await page.evaluate(this.hookEvaluateListPage, ...evaluateParams);
  }

  /**
   *
   * @param {string} productURL The URL of the product to scrape
   * @returns {Promise<DealData>}
   */
  async scrapeProductPage(productURL) {
    const page = this.page;
    await page.goto(productURL);

    // Pre-scraping processes
    await this.hookPreScrapeProductPage(page);

    // Get product page evaluate additional params
    /**@type {any[]} */
    const evaluateParams = await this.hookEvaluateProductPageParams();

    // Scrape the page
    return await page.evaluate(this.hookEvaluateProductPage, ...evaluateParams);
  }

  /**
   * @param {Partial<DealData>[]} initialProductsData - Initial products data
   * @returns {Promise<DealData[]>}
   * @private
   */
  async getFullProductsData(initialProductsData) {
    /**@type {DealData[]} */
    const fullProductsData = [];

    for (let initialProductData of initialProductsData) {
      if (!initialProductData.url) {
        console.warn(
          `Skipping this product since there is no URL present.`,
          initialProductData
        );
        continue;
      }

      /**@type {DealData} */
      const fullProductData = await this.scrapeProductPage(
        initialProductData.url
      );

      fullProductsData.push(fullProductData);
    }

    return fullProductsData;
  }
}

module.exports = DealsScraper;
