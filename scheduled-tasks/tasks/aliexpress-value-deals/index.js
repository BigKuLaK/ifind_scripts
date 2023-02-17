require("../../../helpers/customGlobals");
const pause = require("../../../helpers/pause");
const { addDealsProducts } = appRequire("helpers/main-server/products");
const { query } = appRequire("helpers/main-server/graphql");
const { prerender } = require("../../../helpers/main-server/prerender");

const { getValueDeals } = require("../../../helpers/aliexpress/value-deals");
const { getDetailsFromURL } = require("../../../helpers/aliexpress/api");

const DealTypes = require("../../../ifind-utilities/airtable/models/deal_types");
const { saveLastRunFromProducts } = require("../../utils/task");

const RETRY_WAIT = 30000;

(async () => {
  try {
    console.info("Starting AliExpress Values Deals Task.");

    const aliexpressDealTypeRecord = (await DealTypes.all()).find((record) =>
      /aliexpress/i.test(record.get("id"))
    );

    if (!aliexpressDealTypeRecord) {
      throw `Aliexpres is missing from the Deal Types. Kindly check your records.`;
    }

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
        deal_type: aliexpressDealTypeRecord.get("id"),
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

    await addDealsProducts(aliexpressDealTypeRecord.id, finalProducts);

    await Promise.all([
      await prerender(),
      saveLastRunFromProducts(process.env.taskRecord, finalProducts),
    ]);

    console.info(" DONE ".bgGreen.white.bold);
    process.exit();
  } catch (err) {
    console.error(err, err.data);
    throw err;
  }
})();
