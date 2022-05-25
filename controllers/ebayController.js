const fetch = require('node-fetch');
const axios = require('axios').default;
const { getWowOffers, getMultipleFromIDs } = require("../helpers/ebay/api");
const EBAY_DEAL_TYPE = "ebay_wow_offers";
const endpoint = "https://www.ifindilu.de/graphql";
// const endpoint = "http://localhost:1337/graphql";
// const endpoint = "https:///167.99.136.229/graphql";
let source, region;
const ScheduledTasks = require('../scheduled-tasks');
const { task } = require('../scheduled-tasks/config/_models');
const scheduledTask = new ScheduledTasks;

// API for Add ebay products using graphQL endpoints
exports.fetchEbayAPI = async (req, res) => {
  try {
    scheduledTask.init();
    console.log("Inside FetchEbayAPI", req.body);
    console.log("req.body.taskId ", req.body.taskID);
    console.log("req.body.action ", req.body.action);
    let taskId = req.body.taskID ;
    let action = req.body.action ; 
    console.log("value of action ",action );
    console.log("value of taskId", taskId );
    const data = {
      id: "ebay-wow-offers",
      name: "Ebay Wow Offers",
      schedule: 3600000,
      next_run: 1652941200000,
      status: null,
      last_run: 1652937631453,
      timeout_minutes: 120,
      meta: {
        deal_type: "ebay_wow_offers",
        deal_merchant: "ebay"
      }
    }
    switch (action){
      case 'start' :
        // scheduledTask.addTask(data);
        console.log("starting task : ");
        scheduledTask.start(taskId);
        break;
      case 'stop':
        scheduledTask.stop(taskId);
        break;
      default:
          console.log("Action does not match, action :", action);
    }
    
    // const tasks = scheduledTask.list();
    // console.log("tasks from scheduled tasks : ", tasks);


    const OFFERS_COUNT = 100;
    // await getRegionSources();
    source = 5;
    region = 1;
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
              website_tab: "home",
              deal_type: EBAY_DEAL_TYPE,
              url_list: {
                source: source,
                region: region,
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
              }
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
    // const offers = await getEbayWowOffers();
    // console.log("offers Length", offers.length)
    console.log("Products Scraped from Ebay Servers.");

    // Data comes in offers :   data: offers
    // console.log(offers);
    // const headers = {
    //   "content-type": "application/json",
    // };
    // const graphqlQuery = {
    //   "query": `mutation AddNewProducts ($deal_type:String!, $products: [ProductInput]) {
    //     addProductsByDeals( deal_type: $deal_type, products:$products ){
    //       id
    //       title
    //     }
    //   }
    //   `,
    //   "variables": {
    //     "deal_type": EBAY_DEAL_TYPE,
    //     "products": offers
    //   }
    // }
    // const response = await axios({
    //   url: endpoint,
    //   method: 'POST',
    //   headers: headers,
    //   data: graphqlQuery
    // })
    // const response = await fetch(endpoint,{
    //   method: 'POST',
    //   headers: headers,
    //   body : graphqlQuery,
    // })

    // console.log("Data in response :", response.status);

    return res.status(200).json({
      success: "true",
      msg: "Data added Successully"
    })
  } catch (err) {
    console.log("Errrr--->", err);
    res.status(500).json(
      {
        success: false,
        msg: err.message
      }
    );
  }
}