require("colors");
const {
  getWowOffers,
  getMultipleFromIDs,
} = require("../../../helpers/ebay/api");
const { addDealsProducts } = require("../../../helpers/main-server/products");
const pause = require("../../../helpers/pause");
const { query } = require("../../../helpers/main-server/graphql");
const { prerender } = require("../../../helpers/main-server/prerender");
const {
  getSourceRegion,
} = require("../../../helpers/main-server/sourceRegion");
const { saveLastRunFromProducts } = require("../../utils/task");

const DealTypes = require("../.././../ifind-utilities/airtable/models/deal_types");
const Sites = require("../.././../ifind-utilities/airtable/models/sites");

const START = "start";

const MAX_OFFERS_COUNT = 50;

let ReceivedLogs = null;

let source, region;

let ebayDealType = null;

// Function to get region and source
async function getRegionSources(req, res) {
  try {
    const { source: _source, region: _region } = await getSourceRegion(
      "ebay",
      "de"
    );
    source = _source.id;
    region = _region.id;
  } catch (e) {
    console.log("Error : ", e);
  }
}

const getLogs = async () => {
  let graphqlQuery = `{prerendererLogs {
    type
    date_time
    message
  }}`;
  const res = await query(graphqlQuery);
  ReceivedLogs = res.data.data.prerendererLogs;
  return function () {
    console.log("call back function");
  };
};

const getEbayWowOffers = async () => {
  try {
    const fetchedOffersCount = 0;
    const fetchedOffers = {};
    let page = 1;

    // It makes no sense to have more than 20 pages to fetch,
    // products might only being repeated at that point
    while (fetchedOffersCount <= MAX_OFFERS_COUNT && page <= 20) {
      console.info(`Fething page ${page}...`);

      const offset = page - 1;
      const productDeals = await getWowOffers(100, offset);
      const filteredProducts = [];

      for (const productDeal of productDeals) {
        // Prevent duplicate products
        if (productDeal.itemID in fetchedOffers) {
          continue;
        }

        filteredProducts.push(productDeal);

        // Append sanitized product data
        fetchedOffers[productDeal.itemID] = {
          itemID: productDeal.itemID,
          title: productDeal.title,
          image: productDeal.image,
          url: productDeal.url,
          price: productDeal.price,
          price_original: productDeal.price_original,
          discount_percent: productDeal.discount_percent,
        };

        if (fetchedOffersCount >= MAX_OFFERS_COUNT) {
          break;
        }
      }

      console.info(
        `  - Got ${filteredProducts.length} out of ${productDeals.length} product(s) from page ${page}.`
          .gray
      );

      // Adding delay in order for logs to be picked up.
      await pause();

      page++;
    }

    console.log("Getting additional details...");
    await pause();

    // Get quantity details (not available from Deals API)
    const itemIDs = Object.keys(fetchedOffers);
    const itemDetails = Object.values(fetchedOffers);
    const additionalProductDetails = await getMultipleFromIDs(itemIDs);

    return itemDetails.map((productOfferData) => {
      const additionalDetails =
        additionalProductDetails[productOfferData.itemID];

      // Sanitized product data
      if (additionalDetails) {
        const newProductData = {
          title: productOfferData.title,
          image: productOfferData.image,
          deal_type: ebayDealType.id,
          url_list: [
            {
              merchant: ebayDealType.site,
              url: productOfferData.url,
              price: productOfferData.price,
              price_original: productOfferData.price_original,
              discount_percent: productOfferData.discount_percent,
              quantity_available_percent: Math.round(
                (100 *
                  (additionalDetails.quantity_total -
                    additionalDetails.quantity_sold)) /
                  additionalDetails.quantity_total
              ),
            },
          ],
        };

        console.log(`Fetched product data: ${newProductData.title}`.bold.green);
        pause(500);

        return newProductData;
      }

      return productOfferData;
    });
  } catch (err) {
    console.log(err);
    return [];
  }
};

const getInitialData = async () => {
  await getRegionSources();

  const [dealTypes, sites] = await Promise.all([DealTypes.all(), Sites.all()]);

  ebayDealType = dealTypes.find(({ fields }) =>
    /ebay/i.test(fields.id)
  )?.fields;

  if (ebayDealType) {
    const ebaySite = sites.find(({ fields }) => /ebay/i.test(fields.id));
    ebayDealType.site = ebaySite?.get("id");
  }
};

(async () => {
  try {
    console.log("Getting Ebay Wow Offers...");

    await getInitialData();

    const offers = await getEbayWowOffers();

    console.info(`${offers.length} products scraped from the eBay servers.`);
    pause(100);

    console.info(`Saving new products data`.bold.green);

    const products = await addDealsProducts(ebayDealType.id, offers);

    // Prerender
    await prerender();

    // Save task data
    await saveLastRunFromProducts(process.env.taskRecord, products);

    console.log(" DONE ");
    process.exit();
  } catch (err) {
    console.log("Ebay task exited with error : ", err);
    // console.error(err, err.data);
    process.exit();
  }
})();
