const { getWowOffers, getMultipleFromIDs } = require("./api");

const OFFERS_COUNT = 100;

const getEbayWowOffers = async () => {
  try {
    const fetchedOffersCount = 0;
    const fetchedOffers = {};
    let page = 1;

    // It makes no sense to have more than 20 pages to fetch,
    // products might only being repeated at that point
    while (fetchedOffersCount < OFFERS_COUNT && page <= 20) {
      console.log(`Fething page ${page}...`);

      const offset = page - 1;
      const productDeals = await getWowOffers(100, offset);

      for (const productDeal of productDeals) {
        // Prevent duplicate products
        if (productDeal.itemID in fetchedOffers) {
          continue;
        }

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

        if (fetchedOffersCount >= OFFERS_COUNT) {
          break;
        }
      }

      page++;
    }

    console.log("Getting additional details...");

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
        };

        return newProductData;
      }

      return productOfferData;
    });
  } catch (err) {
    console.error(err.message.red, err.stack);
    return [];
  }
};

module.exports = getEbayWowOffers;
