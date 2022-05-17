const { getValueDeals } = require("../helpers/aliexpress/value-deals");
const { getDetailsFromURL } = require("../helpers/aliexpress/api");
const axios = require('axios').default;
const RETRY_WAIT = 30000;


// API to scrape data and perform corresponding functions 
exports.aliExpressApi = async (req, res) => {
  try {
    console.log("Inside aliExpressApi");
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
        } catch (err) {
          console.error(`Error while fetching ${productLink}: ${err.message}`);
        }
      }

      console.log(`Total of ${productsData.length} products has been fetched.`);

      if (!productsData.length) {
        console.log(
          `No products fetched. Retrying in ${Number(
            RETRY_WAIT / 1000
          )} second(s)...`.magenta
        );
        await new Promise((resolve) => setTimeout(resolve, RETRY_WAIT));
      }
    }
    console.log(" DONE ".bgGreen.white.bold);
    return res.status(200).json({
      success: "true",
      data: productsData,
    })
  } catch (err) {
    console.error(err, err.data);
    throw err;
  }
};
