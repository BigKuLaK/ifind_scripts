require("../../../helpers/customGlobals");
const { addDealsProducts } = appRequire("helpers/main-server/products");
const { query } = appRequire("helpers/main-server/graphql");

const { getValueDeals } = require("../../../helpers/aliexpress/value-deals");
const { getDetailsFromURL } = require("../../../helpers/aliexpress/api");
const {
  getSourceRegion,
} = require("../../../helpers/main-server/sourceRegion");
const Logger = require("../../lib/Logger");

const RETRY_WAIT = 30000;
const ALI_EXPRESS_DEAL_TYPE = "aliexpress_value_deals";
const START = "start";
const STOP = "stop";
let SOURCE, REGION;
let ReceivedLogs = null;

// Function to get Region and Source using GraphQl Endpoint
async function getRegionSources() {
  try {
    const response = await getSourceRegion("aliexpress", "de");
    SOURCE = response.data.data.aliExpressSource[0].id;
    REGION = response.data.data.germanRegion[0].id;
  } catch (e) {
    console.log("Error in graphql enpoints of Region and Sources");
  }
}

const getLogs = async () => {
  const graphqlQuery = `{prerendererLogs {
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
const LOGGER = new Logger({ context: "aliexpress-value-deals" });

(async () => {
  try {
    console.info("Starting AliExpress Values Deals Task.");

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

    console.log("Product Links Fetched : ", valueDealsLinks);
    const finalProducts = [];

    while (!productsData.length) {
      console.log(
        `Getting product details for ${valueDealsLinks.length} product link(s) scraped...`
          .cyan
      );
      for (let productLink of valueDealsLinks) {
        console.info(`Fetching data for: ${productLink}`.gray);

        try {
          const productData = await getDetailsFromURL(productLink);
          productsData.push(productData);

          console.log(
            `[ ${productsData.length} ] Details fetched for ${productData.title.bold}`
              .green
          );
        } catch (err) {
          console.info(`Error while fetching ${productLink}: ${err.message}`);
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

    for (const product of productsData) {
      const newProductData = {
        title: product.title,
        image: product.image,
        website_tab: "home",
        deal_type: ALI_EXPRESS_DEAL_TYPE,
        url_list: {
          source: SOURCE,
          region: REGION,
          url: product.affiliateLink,
          price: parseFloat(product.price),
          price_original: parseFloat(product.price_original),
          discount_percent: parseFloat(product.discount_percent),
        },
      };
      finalProducts.push(newProductData);
    }

    console.log(`Fetched ${productsData.length} products.`.bold.green);

    // Send to save products
    console.log(
      `Sending products data for ${productsData.length} products.`.bold.green
    );

    const response = await addDealsProducts(
      ALI_EXPRESS_DEAL_TYPE,
      finalProducts
    ).catch((err) => {
      console.error(err);
    });

    console.log(`Product sent. Requesting prerender.`.green);
    if (response.status == 200) {
      try {
        const prerender = await query(
          `
        mutation Prerenderer($command:PRERENDERER_COMMAND!) {
          prerenderer( command: $command )
        }`,
          {
            command: START,
          }
        );
        if (prerender.status == 200) {
          console.log("Getting prerender logs from main server");
          await getLogs();
          if (ReceivedLogs != null) {
            for (const i of ReceivedLogs) {
              LOGGER.log(i.message);
            }
          }
          LOGGER.log("Prerender logs added into logger");
        }
      } catch (e) {
        console.log("Error in Aliexpress task : ", e.message);
      }
    } else {
      console.log("prerender not triggered in main server ");
    }
    console.log(" DONE ".bgGreen.white.bold);
    process.exit();
  } catch (err) {
    console.error(err, err.data);
    throw err;
  }
})();
