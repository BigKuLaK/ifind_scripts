const adminStrapi = require("../../../scripts/strapi-custom");
const { getValueDeals } = require("../../../helpers/aliexpress/value-deals");
const { getDetailsFromURL } = require("../../../helpers/aliexpress/api");

const RETRY_WAIT = 30000;
const PRODUCTS_COUNT = 20;

(async () => {
  const strapi = await adminStrapi();
  const [aliexpressSource, germanRegion] = await Promise.all([
    strapi.services.source.findOne({ name_contains: "aliexpress" }),
    strapi.services.region.findOne({ code: "de" }),
  ]);

  try {
    let valueDealsLinks = [];

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

    const productsData = [];

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

          // We only need a certain amount of products
          if (productsData.length == PRODUCTS_COUNT) {
            break;
          }
        } catch (err) {
          console.error(
            `Error while fetching ${productLink}: ${err.message}`
          );
        }
      }

      console.log(
        `Total of ${productsData.length} products has been fetched.`
      );

      if (!productsData.length) {
        console.log(
          `No products fetched. Retring in ${Number(
            RETRY_WAIT / 1000
          )} second(s)...`.magenta
        );
        await new Promise((resolve) => setTimeout(resolve, RETRY_WAIT));
      }
    }

    // Remove old products
    console.log("Removing old products...".green);
    const deletedProducts = await strapi.services.product.delete({
      deal_type: "aliexpress_value_deals",
    });
    console.log(`Deleted ${deletedProducts.length} product(s).`.cyan);

    // Save new products
    console.log("Saving new products...".green);

    let saved = 0;

    for (const productData of productsData) {
      const newData = {
        website_tab: "home",
        deal_type: "aliexpress_value_deals",
        title: productData.title,
        image: productData.image,
        url_list: [
          {
            url: productData.affiliateLink,
            source: aliexpressSource.id,
            region: germanRegion.id,
            price: productData.price,
            price_original: productData.price_original,
            discount_percent: productData.discount_percent,
          },
        ],
      };


      await strapi.services.product.create(newData);
      console.log(`[ ${++saved} of ${productsData.length} ] Successfully saved: ${newData.title.bold}`.green);
    }

    console.log(" DONE ".bgGreen.white.bold);
    process.exit();
  } catch (err) {
    console.error(err, err.data);
    process.exit();
  }
})();
