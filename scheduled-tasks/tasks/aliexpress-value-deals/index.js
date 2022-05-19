const adminStrapi = require("../../../scripts/strapi-custom");
const { getValueDeals } = require("../../../helpers/aliexpress/value-deals");
const { getDetailsFromURL } = require("../../../helpers/aliexpress/api");
const axios = require('axios').default;


const RETRY_WAIT = 30000;

(async () => {
  const strapi = await adminStrapi();
  const [aliexpressSource, germanRegion] = await Promise.all([
    strapi.services.source.findOne({ name_contains: "aliexpress" }),
    strapi.services.region.findOne({ code: "de" }),
  ]);

  try {

    let productsData = null
    await axios.post("http://localhost:3000/aliexpress/getAliExpressData").then(
      (response) => {
        productsData = response.data.data;
        // offers.push(response.data)
      },
      (error) => {
        console.log(error);
      }
    );
    console.log("productsData", productsData);

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
      console.log("productData", productData)
      const newData = {
        website_tab: "home",
        deal_type: "aliexpress_value_deals",
        title: productData.title,
        image: productData.image,
        url_list: [
          {
            url: productData.url,
            source: aliexpressSource.id,
            region: germanRegion.id,
            price: productData.price,
            price_original: productData.price_original,
            discount_percent: productData.discount_percent,
          },
        ],
      };

      await strapi.services.product.create(newData);
      console.log(
        `[ ${++saved} of ${productsData.length} ] Successfully saved: ${newData.title.bold
          }`.green
      );
    }

    console.log(" DONE ".bgGreen.white.bold);
    process.exit();
  } catch (err) {
    console.error(err, err.data);
    throw err;
  }
})();
