// const createStrapiInstance = require("../../../scripts/strapi-custom");
const getLightningOffers = require("../helpers/amazon/lightning-offers");
const createAmazonProductScraper = require("../helpers/amazon/amazonProductScraper");
const amazonLink = require("../helpers/amazon/amazonLink");
const RETRY_WAIT = 10000;
const DEAL_TYPE = "amazon_flash_offers";
const PRODUCTS_TO_SCRAPE = null;

exports.getAmazonProducts = async (req, res) => {
  console.log("Inside getAmazonProducts");
  const productScraper = await createAmazonProductScraper();
  console.log("Product Scrapper created ()");
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
      const productsToScrape = PRODUCTS_TO_SCRAPE || offerProducts.length;
      //   const strapi = await createStrapiInstance();

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

          console.log('quantity available: ' + productData.quantity_available_percent);

          if (!productData || !productData.title || !productData.price || !productData.quantity_available_percent) {
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
          console.info(`Scraped ${scrapedProducts.length} of ${productsToScrape}`.green.bold);

          if (scrapedProducts.length === productsToScrape) {
            break;
          }
        } catch (err) {
          console.error(err);
          continue;
        }
      }

        return res.status(200).json({
          success: true,
          data: scrapedProducts
        })
      }
      productScraper.close();
    }
  catch (err) {
    console.error(err.message);
    productScraper.close();
    throw err;
  }
};
