const getLightningOffers = require("../../../helpers/amazon/lightning-offers");
const createAmazonProductScraper = require("../../../helpers/amazon/amazonProductScraper");
const amazonLink = require("../../../helpers/amazon/amazonLink");

const Logger = require("../../lib/Logger");
const {
  getSourceRegion,
} = require("../../../helpers/main-server/sourceRegion");
const { query } = require("../../../helpers/main-server/graphql");
const { addDealsProducts } = require("../../../helpers/main-server/products");

const RETRY_WAIT = 10000;
const DEAL_TYPE = "amazon_flash_offers";
const PRODUCTS_TO_SCRAPE = 50;
const START = "start";
let ReceivedLogs = null;

let source, region;

// Get Region Source
async function getRegionSources() {
  try {
    const response = await getSourceRegion("amazon_2", "de");
    source = response.data.data.amazonSource[0].id;
    region = response.data.data.germanRegion[0].id;
  } catch (e) {
    console.log("Error : ", e);
  }
}

const getLogs = async () => {
  const res = await query(`{prerendererLogs {
    type
    date_time
    message
  }}`);
  ReceivedLogs = res.data.data.prerendererLogs;
  return function () {
    console.log("call back function");
  };
};

const LOGGER = new Logger({ context: "amazon-lightning-offers" });

(async () => {
  const productScraper = await createAmazonProductScraper();
  const finalProducts = [];

  try {
    console.info("Inside getAmazonProducts task");
    console.info("Product Scrapper created");
    let offerProducts = [];
    let tries = 0;
  
    await getRegionSources();
  
    await new Promise(async (resolve) => {
      while (!offerProducts.length && ++tries <= 3) {

        try {
          console.log("\nFetching from Lightning Offers Page...".cyan);
          const { products, page } = await getLightningOffers();
          offerProducts = products;

          // Reuse page instance
          productScraper.usePage(page);

          break;
        } catch (err) {
          console.error(err);
          console.error(
            `Unable to fetch lightning offers page. Retrying in ${Number(
              RETRY_WAIT / 1000
            )} second(s)...`.red
          );
          await new Promise((resolve) => setTimeout(resolve, RETRY_WAIT));
        }
      }
      resolve();
    });
    if (offerProducts.length) {
      const productsToScrape = PRODUCTS_TO_SCRAPE || offerProducts.length;

      console.info(
        `Scraping details for ${offerProducts.length} products...`.green
      );

      let scrapedProducts = [];
      for (const productLink of offerProducts) {
        try {
          console.info(`Scraping: ${productLink.bold}`);
          const productData = await productScraper.scrapeProduct(
            productLink,
            "de",
            false
          );

          if (
            !productData ||
            !productData.title ||
            !productData.price ||
            !productData.quantity_available_percent
          ) {
            continue;
          }

          // Additional props
          productData.amazon_url = amazonLink(productLink);
          productData.deal_type = DEAL_TYPE;
          productData.website_tab = "home";

          // Preprocess data props
          productData.updateScope = {
            amazonDetails: false,
            price: false,
          };

          // Remove unnecessary props
          delete productData.releaseDate;

          // Add product data
          scrapedProducts.push(productData);

          // Current scraped products info
          console.info(
            `Scraped ${scrapedProducts.length} of ${productsToScrape}`.green
              .bold
          );
          console.info(`Basic product data: `, {
            title: productData.title,
            price: productData.price,
            deal_type: productData.deal_type,
          });

          if (scrapedProducts.length === productsToScrape) {
            break;
          }
        } catch (err) {
          console.error(err);
          continue;
        }
      }

      for (const product of scrapedProducts) {
        const newData = {
          title: product.title,
          image: product.image,
          website_tab: "home",
          deal_type: DEAL_TYPE,
          amazon_url: product.amazon_url,
          // url_list: {
          source: source,
          region: region,
          url: product.url,
          // url: product.amazon_url,
          price: product.price,
          price_original: product.price_original,
          discount_percent: product.discount_percent,
          quantity_available_percent: product.quantity_available_percent,
          // }
        };
        finalProducts.push(newData);
      }
      console.info(
        `Saving Final Products With Length, ${finalProducts.length}`.green
          .bgWhite
      );
    }

    const response = await addDealsProducts(DEAL_TYPE, finalProducts);

    console.log(
      "calling graphql endpoints to trigger prerender in main server"
    );
    if (response.status == 200) {
      try {
        const prerender = await query(
          `
          mutation Prerenderer($command:PRERENDERER_COMMAND!) {
            prerenderer( command: $command )
          }
          `,
          {
            command: START,
          }
        );
        console.log(
          "Response of prerender graphql endpoint : ",
          prerender.status
        );
        if (prerender.status == 200) {
          console.log("Getting prerender logs from main server");
          await getLogs();
          if (ReceivedLogs != null) {
            for (const i of ReceivedLogs) {
              console.log(i.message);
              LOGGER.log(i.message);
            }
          }
          LOGGER.log("Prerender logs added into logger");
        }
      } catch (e) {
        console.log("Error in amazon Product task in  : ", e);
      }
    } else {
      console.log("Prerender not triggered in main server");
    }
    console.log(" DONE ".bgGreen.white.bold);
    productScraper.close();
    process.exit();
  } catch (err) {
    console.error(err.message);
    productScraper.close();
    throw err;
  }
})();
