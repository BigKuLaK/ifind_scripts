const getLightningOffers = require("../helpers/amazon/lightning-offers");
const createAmazonProductScraper = require("../helpers/amazon/amazonProductScraper");
const amazonLink = require("../helpers/amazon/amazonLink");

const RETRY_WAIT = 10000;
const DEAL_TYPE = "amazon_flash_offers";
const PRODUCTS_TO_SCRAPE = null;
var mysql = require('mysql');


var con = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "ifind_admin"
});

// Restful API for scrap amazon data

exports.getAmazonProducts = async () => {
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

      // Remove old products
      // console.log("Removing old products...".green);
      console.info(`Saving scraped products...`.bold);

      // Counter
      let savedProducts = 0;
      con.connect(function (err) {
        var sql = "DELETE FROM products WHERE deal_type= 'amazon_flash_offers'";
        con.query(sql, function (err, result) {
          if (err) throw err;
        });
        console.log("Remove All Data of Ebay Products");
        var sql = "INSERT INTO products SET ?";
        for (const productData of scrapedProducts) {
          // Save product
          try {
            const newProduct = {
              website_tab: "home",
              deal_type: DEAL_TYPE,
              title: productData.title,
              image: productData.image,
              deal_quantity_available_percent: productData.deal_quantity_available_percent,
              source: 4,
              region: 1,
              // url: ebayLink(offer.url),
              price: productData.price,
              price_original: productData.price_original,
              discount_percent: productData.discount_percent,
              quantity_available_percent: productData.quantity_available_percent,
              status: "published"
            };
            console.log(
              `[ ${++savedProducts} of ${scrapedProducts.length} ] Saved new product: ${newProduct.title.bold
                }`.green
            );
          } catch (err) {
            console.error(err.message);
          }
        }
      })
    }
    else {
      console.log('No products were fetched.'.red.bold);
    }

    console.log(" DONE ".bgGreen.white.bold);
    productScraper.close();
    process.exit();
  } catch (err) {
    console.error(err.message);
    productScraper.close();
    throw err;
  }
};
