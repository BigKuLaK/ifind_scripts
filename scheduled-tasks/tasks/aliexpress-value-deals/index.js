require("../../../helpers/customGlobals");
const pause = require("../../../helpers/pause");
const { addDealsProducts } = appRequire("helpers/main-server/products");
const { query } = appRequire("helpers/main-server/graphql");
const { prerender } = require("../../../helpers/main-server/prerender");

const { getValueDeals } = require("../../../helpers/aliexpress/value-deals");
const { getDetailsFromURL } = require("../../../helpers/aliexpress/api");
const {
  getSourceRegion,
} = require("../../../helpers/main-server/sourceRegion");
const aliexpressDealConfig = require("../../../config/deal-types").match(
  /aliexpress/i
);

const RETRY_WAIT = 30000;

(async () => {
  try {
    console.info("Starting AliExpress Values Deals Task.");

    let productsData = [];
    let valueDealsLinks = [];
    await /**@type {Promise<void>} */ (
      new Promise(async (resolve) => {
        while (!valueDealsLinks.length) {
          try {
            console.info("Fetching from Super Value Deals Page...".cyan);
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
      })
    );

    console.info("Product Links Fetched : ", valueDealsLinks);
    const finalProducts = [];

    while (!productsData.length) {
      console.info(
        `Getting product details for ${valueDealsLinks.length} product link(s) scraped...`
          .cyan
      );

      await pause();

      for (let productLink of valueDealsLinks) {
        console.info(`Fetching data for: ${productLink}`.gray);

        try {
          const productData = await getDetailsFromURL(productLink);
          productsData.push(productData);

          console.info(
            `[ ${productsData.length} ] Details fetched for ${productData.title.bold}`
              .green
          );
        } catch (err) {
          console.info(`Error while fetching ${productLink}: ${err.message}`);
        }
      }
      console.info(
        `Total of ${productsData.length} products has been fetched.`
      );
      if (!productsData.length) {
        console.info(
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
        deal_type: aliexpressDealConfig.id,
        url_list: {
          url: product.affiliateLink,
          price: parseFloat(product.price),
          price_original: parseFloat(product.price_original),
          discount_percent: parseFloat(product.discount_percent),
        },
      };
      finalProducts.push(newProductData);
    }

    console.info(`Fetched ${productsData.length} products.`.bold.green);

    // Send to save products
    console.info(
      `Sending products data for ${productsData.length} products.`.bold.green
    );

    const response = await addDealsProducts(
      aliexpressDealConfig.id,
      finalProducts
    ).catch((err) => {
      console.error(err);
    });

    console.info(`Products sent. Requesting prerender.`.green);
    await prerender();

    console.info(" DONE ".bgGreen.white.bold);
    process.exit();
  } catch (err) {
    console.error(err, err.data);
    throw err;
  }
})();
