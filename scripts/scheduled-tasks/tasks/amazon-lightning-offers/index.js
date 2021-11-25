const createStrapiInstance = require("../../../scripts/strapi-custom");
const getLightningOffers = require("../../../helpers/amazon/lightning-offers");
const createAmazonProductScraper = require("../../../helpers/amazon/amazonProductScraper");
const amazonLink = require("../../../helpers/amazon/amazonLink");

const RETRY_WAIT = 10000;
const DEAL_TYPE = "amazon_flash_offers";

(async () => {
  const productScraper = await createAmazonProductScraper();

  try {
    let offerProducts = [];
    let tries = 0;

    await new Promise(async (resolve) => {
      while (!offerProducts.length && ++tries <= 3) {
        try {
          console.log("\nFetching from Lightning Offers Page...".cyan);
          offerProducts = await getLightningOffers();
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
      const strapi = await createStrapiInstance();

      console.log(
        `Scraping details for ${offerProducts.length} products...`.green
      );

      let scrapedProducts = [];
      for (const productLink of offerProducts) {
        try {
          console.log(`Scraping: ${productLink.bold}`);
          const productData = await productScraper.scrapeProduct(
            productLink,
            "de",
            false
          );

          if (!productData || !productData.title || !productData.price) {
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
          console.info(`Scraped ${scrapedProducts.length} of 20`.green.bold);

          if (scrapedProducts.length === 20) {
            break;
          }
        } catch (err) {
          console.error(err);
          continue;
        }
      }

      // Remove old products
      console.log("Removing old products...".green);
      const deletedProducts = await strapi.services.product.delete({
        deal_type: DEAL_TYPE,
      });
      console.log(`Deleted ${deletedProducts.length} product(s).`.cyan);

      console.info(`Saving scraped products...`.bold);

      // Counter
      let savedProducts = 0;

      for ( const productData of scrapedProducts ) {
        // Save product
        try {
          const newProduct = await strapi.query("product").create(productData);
          console.log(
            `[ ${++savedProducts} of ${scrapedProducts.length} ] Saved new product: ${
              newProduct.title.bold
            }`.green
          );
        } catch (err) {
          console.error(err.message);
        }
      }
    }
    else {
      console.log('No products were fetched.'.red.bold);
    }

    console.log(" DONE ".bgGreen.white.bold);
  } catch (err) {
    console.error(err.message);
  }

  productScraper.close()

  process.exit();
})();
