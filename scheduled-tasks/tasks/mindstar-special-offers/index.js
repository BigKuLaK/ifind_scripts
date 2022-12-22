const DealsScraper = require("../../../helpers/deals-scraper");
const mindStarDealConfig = require("../../../config/deal-types").match(/mind/);

/**
 * Typdefs
 *
 * @typedef {import('../../../helpers/deals-scraper').DealData} DealData
 * @typedef {import("../../../config/typedefs/product").Product} Product
 */

const MINDFACTORY_URL = "https://www.mindfactory.de/";
const MINDSTAR_URL = "https://www.mindfactory.de/Highlights/MindStar";
const SELECTORS = {
  productCard: ".hidden-xs.hidden-sm .ms_product",
  productLink: ".ms_prodimage a",
  title: ".ms_prodname",
  currentPrice: ".ms_pricenew [data-mindstar-price]",
  oldPrice: ".priceold [data-minddeal-price-old]",
  availabilityCircle: ".circle-pie",
};

class MindStarSpecialOffers extends DealsScraper {
  dealType = mindStarDealConfig.id;
  skipProductPageScraping = true;

  async hookGetInitialProductsData() {
    const initialProducsData = await this.scrapeListPage(MINDSTAR_URL);
    return initialProducsData;
  }

  async hookPreScrapeListPage(page) {
    console.log("Waiting for selector");
    await page.waitForSelector(SELECTORS.productCard);
  }

  async hookEvaluateListPageParams() {
    return [SELECTORS];
  }

  hookEvaluateListPage(SELECTORS) {
    const productCards = Array.from(
      document.querySelectorAll(SELECTORS.productCard)
    );

    /**@type {Partial<DealData>[]} */
    const productsData = productCards.map((element) => {
      // Get product URL
      const url = element
        .querySelector(SELECTORS.productLink)
        .getAttribute("href");

      // Get product title
      const title = element.querySelector(SELECTORS.title).textContent.trim();

      // Get current Price
      const priceCurrent = Number(
        element
          .querySelector(SELECTORS.currentPrice)
          .textContent.replace(/[^0-9,.]/g, "")
          .replace(/[,.]/g, (match) => (match === "," ? "." : ""))
      );

      // Get old Price
      const priceOld = Number(
        element
          .querySelector(SELECTORS.oldPrice)
          .textContent.replace(/[^0-9,.]/g, "")
          .replace(/[,.]/g, (match) => (match === "," ? "." : ""))
      );

      // Get image
      const backgroundUrls = element.style
        .getPropertyValue("background-image")
        .match(/"[^"]+"/g);
      const backgroundImageUrl = backgroundUrls.pop().slice(1, -1);

      const circle = element.querySelector(SELECTORS.availabilityCircle);
      const circleBackgroundPercentages = circle.style
        .getPropertyValue("background")
        .match(/[0-9]+(.[0-9]+)?%/g)
        .map((percentage) => Number(percentage.replace(/%/, "")));
      const maxPercent = Math.max(...circleBackgroundPercentages);

      return {
        url,
        title,
        priceCurrent,
        priceOld,
        image: backgroundImageUrl,
        discount:
          priceOld !== priceCurrent
            ? Number((((priceOld - priceCurrent) / priceOld) * 100).toFixed(1))
            : undefined,
        availabilityPercent: Number((100 - maxPercent).toFixed(1)),
      };
    });

    return productsData;
  }

  hookNormalizeProductsData(initialProducsData) {
    return initialProducsData.map(
      /**
       * @param {DealData} productData
       * @returns {Product}
       */
      (productData) => ({
        title: productData.title,
        deal_type: mindStarDealConfig.id,
        image: productData.image,
        url_list: [
          {
            url: productData.url,
            price: productData.priceCurrent,
            price_original:
              productData.priceCurrent === productData.priceOld
                ? undefined
                : productData.priceOld,
            discount_percent: productData.discount,
            merchant: mindStarDealConfig.site,
            quantity_available_percent: productData.availabilityPercent,
          },
        ],
      })
    );
  }
}

new MindStarSpecialOffers({
  origin: MINDFACTORY_URL,
  referer: MINDFACTORY_URL,
}).start();
