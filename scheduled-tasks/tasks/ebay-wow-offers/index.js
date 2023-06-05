require("colors");
const {
  getWowOffers,
  getMultipleFromIDs,
} = require("../../../helpers/ebay/api");
const { addDealsProducts } = require("../../../helpers/main-server/products");
const pause = require("../../../helpers/pause");
const { prerender } = require("../../../helpers/main-server/prerender");
const { saveLastRunFromProducts } = require("../../utils/task");

const DealTypes = require("../.././../ifind-utilities/airtable/models/deal_types");
const Sites = require("../.././../ifind-utilities/airtable/models/sites");

const MAX_OFFERS_COUNT = 50;

let ebayDealType = null;

const getEbayWowOffers = async () => {
  try {
    let fetchedOffersCount = 0;
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

        if (++fetchedOffersCount >= MAX_OFFERS_COUNT) {
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

    console.info("Getting additional details...");
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

        console.info(
          `Fetched product data: ${newProductData.title}`.bold.green
        );
        pause(500);

        return newProductData;
      }

      return productOfferData;
    });
  } catch (err) {
    console.info(err);
    return [];
  }
};

const getInitialData = async () => {
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
    console.info("Getting Ebay Wow Offers...");

    await getInitialData();

    const offers = await getEbayWowOffers();

    console.info(`${offers.length} products scraped from the eBay servers.`);
    pause(100);

    console.info(`Saving new products data`.bold.green);

    const products = await addDealsProducts(
      ebayDealType.id,
      offers.slice(0, 300)
    );

    // Prerender
    await prerender();

    // Save task data
    await saveLastRunFromProducts(process.env.taskRecord, products);

    console.info(" DONE ");
    process.exit();
  } catch (err) {
    console.info("Ebay task exited with error : ", err);
    // console.error(err, err.data);
    process.exit();
  }
})();
