const createStrapiInstance = require("../../../scripts/strapi-custom");
const { default: axios } = require("axios");

const RETRY_WAIT = 10000;
const DEAL_TYPE = "amazon_flash_offers";
const PRODUCTS_TO_SCRAPE = null;

(async () => {
  const strapi = await createStrapiInstance();
  const [aliexpressSource, germanRegion] = await Promise.all([
    strapi.services.source.findOne({ name_contains: "aliexpress" }),
    strapi.services.region.findOne({ code: "de" }),
  ]);

  try {
    let scrapedProducts = null
    await axios.post("http://localhost:3000/aliexpress/getAliExpressData").then(
      (response) => {
        scrapedProducts = response.data.data;
        // offers.push(response.data)
      },
      (error) => {
        console.log(error);
      }
    );

    // Remove old products
    console.log("Removing old products...".green);
    const deletedProducts = await strapi.services.product.delete({
      deal_type: DEAL_TYPE,
    });
    console.log(`Deleted ${deletedProducts.length} product(s).`.cyan);

    console.info(`Saving scraped products...`.bold);

    // Counter
    let savedProducts = 0;

    for (const productData of scrapedProducts) {
      // Save product
      try {
        const newProduct = await strapi.query("product").create(productData);
        console.log(
          `[ ${++savedProducts} of ${scrapedProducts.length} ] Saved new product: ${newProduct.title.bold
            }`.green
        );
      } catch (err) {
        console.error(err.message);
      }
    }
    // }
    // else {
    //   console.log('No products were fetched.'.red.bold);
    // }

    console.log(" DONE ".bgGreen.white.bold);
    productScraper.close();
    process.exit();
  } catch (err) {
    console.error(err.message);
    productScraper.close();
    throw err;
  }
})();
