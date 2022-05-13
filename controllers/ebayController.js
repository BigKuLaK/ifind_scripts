const fetch = require('node-fetch');
const axios = require('axios').default;
const { getWowOffers, getMultipleFromIDs } = require("../helpers/ebay/api");
const EBAY_DEAL_TYPE = "ebay_wow_offers";
const endpoint = "https://www.ifindilu.de/graphql";
let [source, region] = ""

// Function for getting regions using graphQL endpoints

async function getRegionSources() {
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
      method: 'post',
      headers: headers,
      data: graphqlQuery
    })
    source = response.data.data.ebaySource[0].id
    region = response.data.data.germanRegion[0].id
  } catch (e) {
    console.log("Error : ", e);
  }
}

// Function for delete products using graphQL endpoints

async function deleteEbayData() {
  const headers = {
    "content-type": "application/json",
  };
  const graphqlQuery = {
    "query": `mutation  DeleteProductsByDeals($deal_type: String) {
      deleteProductsByDeals(deal_type: $deal_type)}`,
    "variables": {
      "deal_type": EBAY_DEAL_TYPE
    }
  }
  try {
    const response = await axios({
      url: endpoint,
      method: 'post',
      headers: headers,
      data: graphqlQuery
    })

  } catch (e) {
    console.log("Error : ", e);
  }
}

// Function for Add products using graphQL endpoints

async function addEbayData(product) {
  console.log("addEbayData")
  await getRegionSources();

  const headers = {
    "content-type": "application/json"
  }
  const graphqlQuery = {
    query: `mutation CreateProduct(
      $deal_type: ENUM_PRODUCT_DEAL_TYPE!
      $title: String!
      $image: String!
      $url_list: [ComponentAtomsUrlWithTypeInput]
    ) {
      createProduct(
        input: {
          data: {
            image: $image
            title: $title
            website_tab: "home"
            deal_type: $deal_type
            url_list: $url_list
          }
        }
      ) {
        product {
          id
        }
      }
    }`,
    variables: {
      image: product.image,
      title: product.title,
      website_tab: "home",
      deal_type: EBAY_DEAL_TYPE,
      url_list: [
        {
          url: product.url,
          source: source,
          region: region,
          price: product.price,
          price_original: product.price_original,
          discount_percent: product.discount_percent,
        },
      ],
    }
  }
  try {

    const response = await axios({
      url: endpoint,
      method: 'post',
      headers: headers,
      data: graphqlQuery
    })
  }
  catch (e) {
    console.log("Error in add API  : ", e);
  }
}

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
    await deleteEbayData();


    for (const product of offers) {
      console.log("Add Ebay Productss")
      await addEbayDate(product);
    }
    return res.status(200).json({
      success: "true",
      // data: offers
      msg: " Data added successfully"
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