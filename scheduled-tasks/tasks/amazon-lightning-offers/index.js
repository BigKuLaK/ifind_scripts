const getLightningOffers = require("../../../helpers/amazon/lightning-offers");
const createAmazonProductScraper = require("../../../helpers/amazon/amazonProductScraper");
const amazonLink = require("../../../helpers/amazon/amazonLink");

const {
  getSourceRegion,
} = require("../../../helpers/main-server/sourceRegion");
const { addDealsProducts } = require("../../../helpers/main-server/products");
const { prerender } = require("../../../helpers/main-server/prerender");
const { saveLastRunFromProducts } = require("../../utils/task");

const RETRY_WAIT = 10000;
const DEAL_TYPE = "amazon_flash_offers";
const PRODUCTS_TO_SCRAPE = 50;

let source, region;

// Get Region Source
async function getRegionSources() {
  try {
    const { source: _source, region: _region } = await getSourceRegion(
      "amazon_2",
      "de"
    );
    source = _source.id;
    region = _region.id;
  } catch (e) {
    console.log("Error : ", e);
  }
}

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
          await productScraper.usePage(page);

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
            `Scraped ${scrapedProducts.length} of ${productsToScrape}: ${productData.title}`
              .green.bold
          );

          console.info(`Basic product data: `, {
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
          deal_type: DEAL_TYPE,
          amazon_url: product.amazon_url,
          source: source,
          region: region,
          url: product.url,
          price: product.price,
          price_original: product.price_original,
          discount_percent: product.discount_percent,
          quantity_available_percent: product.quantity_available_percent,
        };
        finalProducts.push(newData);
      }
      console.info(
        `Saving Final Products With Length, ${finalProducts.length}`.green
          .bgWhite
      );
    }

    console.log("Adding products", finalProducts.length);
    const addedProducts = await addDealsProducts(DEAL_TYPE, finalProducts);

    // Prerender
    await prerender();

    // Save task data
    const taskRecordID = process.env.taskRecord;

    await saveLastRunFromProducts(taskRecordID, addedProducts);

    console.log(" DONE ".bgGreen.white.bold);
    await productScraper.close();
    process.exit();
  } catch (err) {
    console.error(err.message);
    productScraper.close();
    throw err;
  }
})();
