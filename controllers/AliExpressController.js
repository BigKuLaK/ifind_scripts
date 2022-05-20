const { getValueDeals } = require("../helpers/aliexpress/value-deals");
const { getDetailsFromURL } = require("../helpers/aliexpress/api");
const axios = require('axios').default;
const RETRY_WAIT = 30000;
const endpoint = "https://www.ifindilu.de/graphql";
// const endpoint = "http://localhost:1337/graphql";
// const endpoint = "https:///167.99.136.229/graphql";

const ALI_EXPRESS_DEAL_TYPE = "aliexpress_value_deals";
let SOURCE, REGION ;

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

// API to scrape data and perform corresponding functions 
exports.aliExpressApi = async (req, res) => {
  try {
    console.log("Inside aliExpressApi");
    let valueDealsLinks = [];
    await getRegionSources();
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
    const finalProducts = [];
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
      console.log("Products : ", productsData);
      for (const product of productsData){
       const newProductData = {
         title:product.title,
         image:product.image,
         website_tab:"home",
         deal_type: ALI_EXPRESS_DEAL_TYPE,
         url_list: {
          source : SOURCE,
          region : REGION,
          url: product.affiliateLink,
          price: parseFloat(product.price),
          price_original: parseFloat(product.price_original),
          discount_percent: parseFloat(product.discount_percent),
       }
      }
      finalProducts.push(newProductData);
    }      
      if (!productsData.length) {
        console.log(
          `No products fetched. Retrying in ${Number(
            RETRY_WAIT / 1000
          )} second(s)...`.magenta
        );
        await new Promise((resolve) => setTimeout(resolve, RETRY_WAIT));
      }
    }
    console.log("Products Fetched : ", productsData);
    const headers = {
      "content-type": "application/json",
    };
    const graphqlQuery = {
      "query" : `mutation AddNewProducts ($deal_type:String!, $products: [ProductInput]) {
        addProductsByDeals( deal_type: $deal_type, products:$products ){
          id
          title
        }
      }
      `,
      "variables" : {
        "deal_type": ALI_EXPRESS_DEAL_TYPE,
        "products" : finalProducts
      }
    }
    const response = await axios({
      url:endpoint,
      method:'POST',
      headers : headers,
      data: graphqlQuery 
    })
    console.log("Response from graphql Endpoint : ", response.status);
    console.log(" DONE ".bgGreen.white.bold);
    
    return res.status(200).json({
      success: "true",
      data: finalProducts,
    })
  } catch (err) {
    console.error(err, err.data);
    throw err;
  }
};
