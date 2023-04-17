const DealsScraper = require("../../../helpers/deals-scraper");
const { addURLParams } = require("../../../helpers/url");
const fetch = require("node-fetch");

/**
 * @typedef {import("../../../helpers/deals-scraper").DealData} DealData
 * @typedef {import("../../../helpers/deals-scraper").DealTypeMeta} DealTypeMeta
 * @typedef {import("../../../config/typedefs/product").Product} Product
 * @typedef {import('puppeteer').Page} Page
 */

const BASE_URL = "https://www.bonprix.de";

class TakkoFashion extends DealsScraper {
  skipProductPageScraping = true;

  constructor() {
    super({
      referer: BASE_URL,
      origin: BASE_URL,
    });
  }

  async hookListPagePaginatedURL(url, page) {
    return addURLParams(url, {
      page,
    });
  }

  async hookGetInitialProductsData(dealType) {
    let currentPage = 1;
    let currentPageURL = await this.hookListPagePaginatedURL(
      dealType.url,
      currentPage
    );
    const products = [];

    while (currentPageURL) {
      console.info(`[DEALSCRAPER] Scraping page ${currentPage}`);
      const scrapedProducts = await this.scrapeListPage(currentPageURL);

      products.push(...scrapedProducts);
      currentPageURL = scrapedProducts.length
        ? await this.hookListPagePaginatedURL(dealType.url, ++currentPage)
        : "";
    }

    return products;
  }

  async scrapeListPage(currentURL) {
    const data = await fetch(currentURL)
      .then((res) => res.json())
      .then(({ preactModel }) => JSON.parse(preactModel));

    return data
      .map(({ title, firstViewColorIDs, styles, ...data }) => {
        const [defaultColorID] = firstViewColorIDs;

        for (let { colors } of styles) {
          const defaultStyle = colors.find(({ id }) => id === defaultColorID);

          if (defaultStyle) {
            return {
              title,
              image: defaultStyle.images[0].fallbackSrc,
              priceCurrent: Number(defaultStyle.price.value),
              priceOld: Number(defaultStyle.price.formerPrice.value),
              discount: Number(defaultStyle.price.reduction),
              url: `${BASE_URL}${defaultStyle.url}`,
            };
          }
        }
      })
      .filter(Boolean);
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

new TakkoFashion().start();
