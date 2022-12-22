require("../../../helpers/customGlobals");
const pause = require("../../../helpers/pause");
const { addDealsProducts } = require("../../../helpers/main-server/products");
const { query } = require("../../../helpers/main-server/graphql");

const { getValueDeals } = require("../../../helpers/aliexpress/value-deals");

const { getDetailsFromURL } = require("../../../helpers/aliexpress/api");

const {
  getSourceRegion,
} = require("../../../helpers/main-server/sourceRegion");
const aliexpressDealConfig = require("../../../config/deal-types").match(
  /aliexpress/i
);

const DealsScraper = require("../../../helpers/deals-scraper");

const BASE_URL = "https://de.aliexpress.com/";
const RETRY_WAIT = 30000;

/**
 * @extends {DealsScraper}
 */
class AliExpressValueDeals extends DealsScraper {
  // AliExpress Deal Type ID
  dealType = aliexpressDealConfig.id;

  async hookGetInitialProductsData() {
    let valueDealsLinks = [];
    await new Promise(async (resolve) => {
      while (!valueDealsLinks.length) {
        try {
          console.log("Fetching from Super Value Deals Page...".cyan);
          valueDealsLinks = await getValueDeals();
        } catch (err) {
          console.error(err);
          console.error(
            `Unable to fetch deals page. Retrying in ${Number(
              RETRY_WAIT / 1000
            )} second(s)...`.red
          );
          await new Promise((resolve) => setTimeout(resolve, RETRY_WAIT));
        }
      }
      resolve(null);
    });

    console.log("Product Links Fetched : ", valueDealsLinks);

    return valueDealsLinks.map((url) => ({ url }));
  }
}

new AliExpressValueDeals({
  referer: BASE_URL,
  origin: BASE_URL,
}).start();
