const fetch = require('node-fetch');
const axios = require('axios').default;
const { getWowOffers, getMultipleFromIDs } = require("../helpers/ebay/api");
const EBAY_DEAL_TYPE = "ebay_wow_offers";
// const endpoint = "https://www.ifindilu.de/graphql";
// const endpoint = "http://localhost:1337/graphql";
// const endpoint = "https:///167.99.136.229/graphql";
// API for Add ebay products using graphQL endpoints
exports.fetchEbayAPI = async (req, res) => {
  try {
    console.log("Inside FetchEbayAPI");
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
        console.log(err)
        return [];
      }
    };
    const offers = await getEbayWowOffers();
    console.log("offers Length", offers.length)
    console.log("Prodcuts Scraped from Ebay Servers.");

    console.log("Sending request to delete products from main server ");
    return res.status(200).json({
      success: "true",
      data: offers
    })
  } catch (err) {
    res.status(500).json(
      {
        success: false,
        msg: err.message
      }
    );
  }
}