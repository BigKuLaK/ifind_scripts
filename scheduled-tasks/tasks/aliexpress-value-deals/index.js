const { getValueDeals } = require("../../../helpers/aliexpress/value-deals");
const { getDetailsFromURL } = require("../../../helpers/aliexpress/api");
const path = require("path");
const Logger = require("../../lib/Logger");
const baseDir = path.resolve(__dirname);
const endpoint = "https://www.ifindilu.de/graphql";
// const endpoint = "http://localhost:1337/graphql";
// const endpoint = "https:///167.99.136.229/graphql";
const RETRY_WAIT = 30000;
const ALI_EXPRESS_DEAL_TYPE = "aliexpress_value_deals";
const START = "start";
const STOP = "stop";
let SOURCE, REGION ;
let ReceivedLogs = null;

const axios = require('axios').default;

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
    console.log("Error in graphql enpoints of Region and Sources");
  }
}

const getLogs = async() => {
  let headers = {
    "content-type": "application/json",
  };
  let graphqlQuery = {
    "query" : `{prerendererLogs {
      type
      date_time
      message
    }}`
  }
  const res = await axios({
    url:endpoint,
    method: 'POST',
    headers : headers,
    data : graphqlQuery
  })
  // console.log("res--->", res);
  ReceivedLogs = res.data.data.prerendererLogs;
  // console.log("ReceivedLogs--->", ReceivedLogs);
  return function () {
    console.log("call back function");
  }
}
const LOGGER = new Logger({ baseDir });

(async () => {
  try {
    console.log("inside Ali express task");
    let productsData = []; 
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

    console.log("Product Links Fetched : ",valueDealsLinks);
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
      if (!productsData.length) {
        console.log(
          `No products fetched. Retrying in ${Number(
            RETRY_WAIT / 1000
          )} second(s)...`.magenta
        );
        await new Promise((resolve) => setTimeout(resolve, RETRY_WAIT));
      }
    }

    console.log("Products Fetched : ", productsData.length);
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
        if(prerender.status == 200){
          console.log("Getting prerender logs from main server");
          // Get prerender logs from main server
          // setTimeout(async () => {
            await getLogs()
          // }, 1000);
          // await getLogs();
          if(ReceivedLogs != null){
            for(const i of ReceivedLogs){
              console.log(i.message);
              LOGGER.log(i.message);
            }
          }
          LOGGER.log("Prerender logs added into logger");
        }
      } catch (e) {
        console.log("Error in Ebay task : ", e);
      }
    }
    else{
      console.log("prerender not triggered in main server ")
    }
    console.log(" DONE ".bgGreen.white.bold);
    process.exit();
  } catch (err) {
    console.error(err, err.data);
    throw err;
  }
})();
