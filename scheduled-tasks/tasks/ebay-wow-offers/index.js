// const createStrapiInstance = require("../../../scripts/strapi-custom");
// const getEbayWowOffers = require("../../../helpers/ebay/wow-offers");
// const ebayLink = require("../../../helpers/ebay/ebayLink");
// const { NULL } = require("node-sass");
const axios = require('axios').default;
const fetch = require('node-fetch');
const { getWowOffers, getMultipleFromIDs } = require("../../../helpers/ebay/api");
const endpoint = "https://www.ifindilu.de/graphql";
// const endpoint = "http://localhost:1337/graphql";
// const endpoint = "https:///167.99.136.229/graphql";
const START = "start";
const STOP = "stop";
const EBAY_DEAL_TYPE = "ebay_wow_offers";

// Function to get region and source
async function getRegionSources(req, res) {
  const headers = {
    "content-type": "application/json",
  };
  const graphqlQuery = {
    "query": `{
      ebaySource: sources(where:{ name_contains: "ebay" }) {
      id
      }
      germanRegion: regions(where:{ code:"de" }) {
        id
      }
    }`,
  }

  try {
    const response = await axios({
      url: endpoint,
      method: 'POST',
      headers: headers,
      data: graphqlQuery
    })
    source = response.data.data.ebaySource[0].id
    region = response.data.data.germanRegion[0].id
  } catch (e) {
    console.log("Error : ", e);
  }
}

(async () => {
  try {
    console.log("Getting Ebay Wow Offers...");
    // const offers = await getEbayWowOffers();
    // await axios.post("http://localhost:3000/ebay/fetchEbayStore",{
    //   headers:{
    //     'Connection' : 'keep-alive'
    //   }
    // })
    // .then(
    //   (response) => {
    //     offers = response.data.data;
    //     // offers.push(response.data)
    //   },
    //   (error) => {
    //     console.log(error);
    //   }
    // );
    // console.log("offers", offers);
    // await getRegionSources();
    const OFFERS_COUNT = 100;
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
    const offers = await getEbayWowOffers();
    console.log("offers Length", offers.length)
    console.log("Prodcuts Scraped from Ebay Servers.");
    // console.log(offers);
    const headers = {
      "content-type": "application/json",
    };
    const graphqlQuery = {
      "query": `mutation AddNewProducts ($deal_type:String!, $products: [ProductInput]) {
        addProductsByDeals( deal_type: $deal_type, products:$products ){
          id
          title
        }
      }
      `,
      "variables": {
        "deal_type": EBAY_DEAL_TYPE,
        "products": offers
      }
    }
    const response = await axios({
      url: endpoint,
      method: 'POST',
      headers: headers,
      data: graphqlQuery
    })
    // const response = await fetch(endpoint,{
    //   method: 'POST',
    //   headers: headers,
    //   body : graphqlQuery,
    // })
    console.log("Status of main server graphql :", response.status);
    if(response.status == 200){
      try {
        let headers = {
          "content-type": "application/json",
        };
        let graphqlQuery = {
          "query": `
          mutation Prerenderer($command:PRERENDERER_COMMAND!) {
            prerenderer( command: $command )
          }
          `,
          "variables": {
            "command": START
          }
        }
        const prerender = await axios({
          url: endpoint,
          method: 'POST',
          headers: headers,
          data: graphqlQuery
        })
        console.log("Response of prerender graphql endpoint : ", prerender.status);
      } catch (e) {
        console.log("Error in Ebay task : ", e);
      }
    }
    else{
      console.log("prerender not triggered in main server ")
    }
    console.log(" DONE ");
    process.exit();
  } catch (err) {
    console.log("Ebay task exited with error : ");
    // console.error(err, err.data);
    process.exit();
  }
})();
