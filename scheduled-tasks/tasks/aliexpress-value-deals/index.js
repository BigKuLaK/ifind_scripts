require("colors");
const { getDetailsFromURL } = require("../../../helpers/aliexpress/api");
const aliexpressDealConfig = require("../../../config/deal-types").match(
  /aliexpress/i
);
const DealsScraper = require("../../../helpers/deals-scraper");

/**
 * Typedefs
 *
 * @typedef {import('puppeteer').Page} Page
 * @typedef {import('../../../helpers/deals-scraper').DealData} DealData
 * @typedef {import('../../../config/typedefs/product').ProductDealData} ProductDealData
 * @typedef {import('../../../config/typedefs/product').Product} Product
 */

const BASE_URL = "https://de.aliexpress.com/";

const VALUE_DEALS_PAGE_URL =
  "https://campaign.aliexpress.com/wow/gcp/sd-g-2022/index";
const PRODUCT_CARD_SELECTOR =
  ".lte-header + .lte-cell ~ .lte-cell .rax-view-v2[data-before-current-y]";
const BOTTOM_CARDS_CONTAINER_SELECTOR =
  ".lte-header + .lte-cell ~ .lte-cell:nth-child(20)";
const COOKIES = [
  {
    name: "int_locale",
    value: "de_DE",
    url: VALUE_DEALS_PAGE_URL,
    domain: ".aliexpress.com",
    path: "/",
  },
  {
    name: "aep_usuc_f",
    value: "site=deu&c_tp=PHP&region=PH&b_locale=de_DE",
    url: VALUE_DEALS_PAGE_URL,
    domain: ".aliexpress.com",
    path: "/",
  },
];

class AliExpressValueDeals extends DealsScraper {
  // AliExpress Deal Type ID
  dealType = aliexpressDealConfig.id;

  async hookGetInitialProductsData() {
    const initiaProductsData = await this.scrapeListPage(VALUE_DEALS_PAGE_URL);
    return initiaProductsData;
  }

  /**@param {Page} page */
  async hookPreScrapeListPage(page) {
    // Just enough viewport width
    await page.setViewport({
      width: 1920,
      height: 20000,
    });

    // Set cookies so we can access AliExpress Deals Page
    console.info("Setting cookies".cyan);
    await page.setCookie(...COOKIES);

    // Wait for selector
    console.info("Waiting for required selector");
    await page.waitForSelector(`${BOTTOM_CARDS_CONTAINER_SELECTOR}`, {
      timeout: 30000,
    });
  }

  async hookEvaluateListPageParams() {
    return [PRODUCT_CARD_SELECTOR];
  }

  hookEvaluateListPage(PRODUCT_CARD_SELECTOR) {
    const productCards = Array.from(
      document.querySelectorAll(PRODUCT_CARD_SELECTOR)
    );

    return productCards
      .map((element) => ({
        // Extract link from react component data
        url: element._r._internal.m._internal.m._internal.m.props.href,
      }))
      .filter(({ url }) => Boolean(url));
  }

  /**
   *
   * @param {DealData[]} initiaProductsData
   */
  async hookGetFullProductsData(initiaProductsData) {
    /**@type {DealData[]} */
    const productsData = [];

    for (let initialData of initiaProductsData) {
      const url = `https:${initialData.url.split("?")[0]}`;
      console.info(`Fetching data for: ${url}`.gray);

      try {
        const productData = await getDetailsFromURL(url);

        if (productData) {
          productsData.push({
            url: url,
            title: productData.title,
            image: productData.image,
            priceCurrent: Number(productData.price),
            priceOld: Number(productData.price),
            discount: Number(productData.discount_percent),
          });

          console.log(
            `[ ${productsData.length} ] Details fetched for ${productData.title.bold}`
              .green
          );
        }
      } catch (err) {
        console.info(`Error while fetching ${url}: ${err.message}`);
      }
    }

    return productsData;
  }

  /**
   * @param {DealData[]} productDealsData
   * @returns {Promise<Product[]>}
   */
  async hookNormalizeProductsData(productDealsData) {
    return productDealsData.map((dealData) => ({
      title: dealData.title,
      image: dealData.image,
      deal_type: aliexpressDealConfig.id,
      url_list: [
        {
          url: dealData.url,
          merchant: aliexpressDealConfig.site,
          price: dealData.priceCurrent,
          price_original: dealData.priceOld,
        },
      ],
    }));
  }
}

new AliExpressValueDeals({
  referer: BASE_URL,
  origin: BASE_URL,
}).start();
