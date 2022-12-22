const createTorProxy = require("../../../helpers/tor-proxy");
const DealsScraper = require("../../../helpers/deals-scraper");
const mindStarDealConfig = require("../../../config/deal-types").match(/mind/);

/**
 * Typdefs
 *
 * @typedef {import('../../../helpers/deals-scraper').DealData} DealData
 */

const MINDFACTORY_URL = "https://www.mindfactory.de/";
const MINDSTAR_URL = "https://www.mindfactory.de/Highlights/MindStar";
const SELECTORS = {
  mindStarLink: 'a[title="MindStar"]',
  productCard: ".hidden-xs.hidden-sm .ms_product",
  productLink: ".ms_prodimage a",
  availabilityCircle: ".circle-pie",
};
const PAGE_TIMEOUT = 30000;

class MindStarSpecialOffers extends DealsScraper {
  dealType = mindStarDealConfig.id;

  async hookGetInitialProductsData() {
    console.log({ MINDSTAR_URL });
    const initialProducsData = await this.scrapeListPage(MINDSTAR_URL);

    console.log(initialProducsData);

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
      const link = element.querySelector(SELECTORS.productLink);
      const url = link.getAttribute("href");
      const circle = element.querySelector(SELECTORS.availabilityCircle);
      const circleBackgroundPercentages = circle.style
        .getPropertyValue("background")
        .match(/[0-9]+(.[0-9]+)?%/g)
        .map((percentage) => Number(percentage.replace(/%/, "")));
      const maxPercent = Math.max(...circleBackgroundPercentages);

      return {
        url,
        availabilityPercent: Number((100 - maxPercent).toFixed(2)),
      };
    });

    return productsData;
  }
}

new MindStarSpecialOffers({
  origin: MINDFACTORY_URL,
  referer: MINDFACTORY_URL,
}).start();
