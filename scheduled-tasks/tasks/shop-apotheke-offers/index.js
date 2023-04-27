const DealsScraper = require("../../../helpers/deals-scraper");
const fetch = require("node-fetch");

/**
 * @typedef {import("../../../helpers/deals-scraper").DealData} DealData
 * @typedef {import("../../../helpers/deals-scraper").DealTypeMeta} DealTypeMeta
 * @typedef {import("../../../config/typedefs/product").Product} Product
 * @typedef {import('puppeteer').Page} Page
 */

const BASE_URL = "https://www.shop-apotheke.com/";

class ShopApothekeOffers extends DealsScraper {
  skipProductPageScraping = true;

  constructor() {
    super({
      referer: BASE_URL,
      origin: BASE_URL,
    });
  }

  async hookGetInitialProductsData(dealType) {
    const products = [];

    for (let currentURL of dealType.url) {
      let currentPage = 1;
      let willFetchPage = true;

      while (willFetchPage) {
        console.info(`[DEALSCRAPER] Scraping page ${currentPage}`);
        const { results } = await this.scrapeListPage(
          currentURL,
          currentPage - 1
        );

        if (results.length) {
          const { hits, page, nbPages } = results[0];
          const scrapedProducts = hits
            .filter(({ hasImage }) => hasImage)
            .map(
              ({
                price,
                listPrice,
                image,
                productName,
                deeplink,
                discountInPercent,
              }) => ({
                url: `${BASE_URL}${deeplink}`,
                title: productName,
                priceCurrent: price / 100,
                priceOld: listPrice / 100,
                discount: discountInPercent,
                image,
              })
            );

          products.push(...scrapedProducts);

          // Check if we have next page
          if (page < nbPages - 1) {
            currentPage++;
            continue;
          }
        }

        willFetchPage = false;
      }
    }

    return products;
  }

  async scrapeListPage(currentURL, currentPage) {
    return await fetch(currentURL, {
      method: "post",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        requests: [
          {
            indexName: "products_mktplc_prod_DE_de_topsellerCount_desc",
            params: `page=${currentPage}&highlightPreTag=%3Cais-highlight-0000000000%3E&highlightPostTag=%3C%2Fais-highlight-0000000000%3E&hitsPerPage=500&filters=(discountInPercent%20%3E%3D%2035%20AND%20prescriptionMedicine%3Afalse)%20AND%20(stockStatusReason%3Aproduct.stockStatus.available%20OR%20stockStatusReason%3Aproduct.stockStatus.nl)&query=&facetingAfterDistinct=false&getRankingInfo=true&clickAnalytics=true&analytics=true&analyticsTags=%5B%22results%22%2C%22desktop%22%2C%22externe%22%5D&distinct=true&ruleContexts=%5B%22Angebote%22%5D&maxValuesPerFacet=10000&facets=%5B%22pharmaForm%22%2C%22variants.packSize%22%2C%22price%22%2C%22averageRating%22%2C%22brandIntern%22%2C%22nowProductGroup%22%2C%22filterAttributes%22%2C%22primaryCategory%22%2C%22activeSubstances%22%2C%22prescriptionMedicine%22%2C%22manufacturer%22%2C%22potency%22%2C%22hair_type_multi%22%2C%22skin_type_multi%22%2C%22uv_protection%22%2C%22application_areas%22%2C%22lens_types%22%2C%22absorbency%22%2C%22book_language%22%2C%22authors%22%2C%22animal_species%22%2C%22schuessler_salts%22%2C%22voltage%22%2C%22life_stage%22%2C%22variety%22%2C%22special_needs%22%2C%22packSize%22%2C%22shippingOptions%22%5D&tagFilters=`,
          },
        ],
      }),
    }).then((res) => res.json());
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

new ShopApothekeOffers().start();
