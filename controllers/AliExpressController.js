const { getValueDeals } = require("../helpers/aliexpress/value-deals");
const { getDetailsFromURL } = require("../helpers/aliexpress/api");
const axios = require('axios').default;
const RETRY_WAIT = 30000;
const ALIEXPRESS_DEAL_TYPE = "aliexpress_value_deals";
const endpoint = "https://www.ifindilu.de/graphql";
let [SOURCE, REGION] = "";

// Function to get Region and Source using GraphQl Endpoint
async function getRegionSources() {
  console.log("inside getRegionSources")
  const headers = {
    "content-type": "application/json",
  };
  const graphqlQuery = {
    "query": `{
       aliExpressSource: sources(where:{ name_contains: "aliexpress" }) {
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
    console.log("Region ", response.data.data.germanRegion[0].id);
    console.log("Source ", response.data.data.aliExpressSource[0].id);
    SOURCE = response.data.data.aliExpressSource[0].id;
    REGION = response.data.data.germanRegion[0].id

  } catch (e) {
    console.log("Error : ", e);
  }
}

// Function to delete Data using graphql Endpoint
async function deleteAliExpressData() {
  const headers = {
    "content-type": "application/json",
  };
  const graphqlQuery = {
    "query": `mutation  DeleteProductsByDeals($deal_type: String) {
      deleteProductsByDeals(deal_type: $deal_type)}`,
    "variables": {
      "deal_type": ALIEXPRESS_DEAL_TYPE
    }
  }
  try {
    const response = await axios({
      url: endpoint,
      method: 'post',
      headers: headers,
      data: graphqlQuery
    })
    await getRegionSources();
  } catch (e) {
    console.log("Error : ", e);
  }
}

// Function to add scraped data into Strapi database using Graphql Endpoints
async function addAliExpressData(product) {
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
      deal_type: ALIEXPRESS_DEAL_TYPE,
      url_list: [
        {
          url: product.url,
          source: SOURCE,
          region: REGION,
          price: product.price,
          price_original: product.price_original,
          discount_percent: product.discount_percent,
          quantity_available_percent: product.quantity_available_percent,
        },
      ],
    }
  }
  console.log("graphqlQuery",graphqlQuery.variables)
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

// API to scrape data and perform corresponding functions 
exports.aliExpressApi = async (req, res) => {
  try {
    console.log("Inside aliExpressApi");
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
      resolve();
    });

    const productsData = [];

    while (!productsData.length) {
      console.log(
        `Getting product details for ${valueDealsLinks.length} product link(s) scraped...`
          .cyan
      );
      for (let productLink of valueDealsLinks) {
        console.log(`Fetching data for: ${productLink}`.gray);

        try {
          const productData = await getDetailsFromURL(productLink);
          productsData.push(productData);

          console.log(
            `[ ${productsData.length} ] Details fetched for ${productData.title.bold}`
              .green
          );
        } catch (err) {
          console.error(`Error while fetching ${productLink}: ${err.message}`);
        }
      }

      console.log(`Total of ${productsData.length} products has been fetched.`);

      if (!productsData.length) {
        console.log(
          `No products fetched. Retrying in ${Number(
            RETRY_WAIT / 1000
          )} second(s)...`.magenta
        );
        await new Promise((resolve) => setTimeout(resolve, RETRY_WAIT));
      }
    }
    // Add data into Strapi database using graphql endpoint 
    if (productsData.length > 0) {
      await deleteAliExpressData();
      for (product of productsData) {
        await addAliExpressData(product);
        console.log("Add Aliexpress data");
      }
    } else {
      console.log("No Data found, Nothing to delete/add");
    }
    console.log(" DONE ".bgGreen.white.bold);
    return res.status(200).json({
      success: "true",
      msg: "Data added successfully"
    })
  } catch (err) {
    console.error(err, err.data);
    throw err;
  }
};
