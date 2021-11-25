require("colors");

const adminStrapi = require("../../../scripts/strapi-custom");
const { isAmazonLink, scrapeAmazonProduct } = require("../../../helpers/amazon");
const { getDetailsFromURL: getDetailsFromEbayURL } = require("../../../helpers/ebay");
const { getDetailsFromURL: getDetailsFromAliExppressURL } =
  require("../../../helpers/aliexpress");
  const createAmazonProductScraper = require('../../../helpers/amazon/amazonProductScraper');

(async () => {
  const scraper = await createAmazonProductScraper();

  try {
    const strapi = await adminStrapi();

    const queryParams = {
      website_tab: "product_comparison",
      _limit: 9999,
      _sort: "id:desc",
    };

    const sources = await strapi.services.source.find();
    const foundProducts = await strapi.services.product.find(queryParams);

    // Sources
    const ebaySource = sources.find(({ name }) => /ebay/i.test(name));
    const aliexpressSource = sources.find(({ name }) => /ali/i.test(name));

    console.log(
      `Running price updater on ${foundProducts.length} product(s)...`.cyan
    );

    for (let i = 0; i < foundProducts.length; i++) {
      const product = foundProducts[i];
      const productUpdates = {};

      console.log(
        `[ ${i + 1} of ${foundProducts.length} ]`.cyan.bold +
          ` Updating - [${String(product.id).bold}] ${product.title}`
      );

      // Scrape amazon price
      if (!isAmazonLink(product.amazon_url)) {
        console.error(
          `Invalid amazon url for [ ${product.id} ] - ${product.title}`
        );
      } else {
        try {
          const scrapedDetails = await scraper.scrapeProduct(
            product.amazon_url,
            "en",
            true
          );

          if (scrapedDetails && scrapedDetails.price) {
            productUpdates.price = Number(scrapedDetails.price);
          }
        } catch (err) {
          console.error(err.stack);
        }
      }

      // Scrape price for other URLs
      if (product.url_list && product.url_list.length) {
        productUpdates.url_list = [];

        for (const urlData of product.url_list) {
          // Get old data
          const urlDataUpdate = {
            id: urlData.id,
            source: urlData.source.id,
            price: urlData.price,
          };

          switch (urlData.source.id) {
            // Get Ebay Price
            case ebaySource.id:
              const ebayDetails = await getDetailsFromEbayURL(urlData.url);

              if (ebayDetails && ebayDetails.price) {
                urlDataUpdate.price = Number(ebayDetails.price);
              }
              break;

            // Get AliExpress Price
            case aliexpressSource.id:
              try {
                const aliExpressDetails = await getDetailsFromAliExppressURL(
                  urlData.url
                );
                if (aliExpressDetails && aliExpressDetails.price) {
                  urlDataUpdate.price = Number(aliExpressDetails.price);
                }
              } catch (err) {
                console.error(
                  "AliEpress error: Product link is non-affiliate".red
                );
              }
              break;
          }

          productUpdates.url_list.push(urlDataUpdate);
        }
      }

      // Save amazon price update as well as url_list updates
      await strapi.services.product.updateProduct(
        product.id,
        productUpdates,
        { price: false, amazonDetails: false },
        { change_type: "price_updater_results" }
      );
    }

    console.log(" DONE ".bgGreen.white.bold);
  } catch (err) {
    console.error(err);
  }

  scraper.close();
  process.exit();
})();
