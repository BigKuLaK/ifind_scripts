require("colors");
require("../../../helpers/customGlobals");

const adminStrapi = appRequire("scripts/strapi-custom");
const { isAmazonLink, scrapeAmazonProduct } = appRequire("helpers/amazon");
const { getDetailsFromURL: getDetailsFromEbayURL } = appRequire("helpers/ebay");
const { getDetailsFromURL: getDetailsFromAliExppressURL } =
  appRequire("helpers/aliexpress");
const createAmazonProductScraper = appRequire('helpers/amazon/amazonProductScraper');

(async () => {
  const scraper = await createAmazonProductScraper();

  try {
    const strapi = await adminStrapi();

    const queryParams = {
      status: "published",
      website_tab: "product_comparison",
      _limit: 9999,
      _sort: "id:desc",
    };

    const sources = await strapi.services.source.find();
    const foundProducts = await strapi.services.product.find(queryParams);
    const productsWithIssues = [];

    // Sources
    const ebaySource = sources.find(({ name }) => /ebay/i.test(name));
    const aliexpressSource = sources.find(({ name }) => /ali/i.test(name));

    console.log(
      `Running validator on ${foundProducts.length} product(s)...`.cyan
    );

    for (let i = 0; i < foundProducts.length; i++) {
      const product = foundProducts[i];
      const productIssues = [];

      console.log(
        `[ ${i + 1} of ${foundProducts.length} ]`.cyan.bold +
          ` Validating - [${String(product.id).bold}] ${product.title}`
      );

      // Validate amazon link
      if (!isAmazonLink(product.amazon_url)) {
        console.error(
          `Invalid amazon url for [ ${product.id} ] - ${product.title}`
        );
        productIssues.push("amazon_link_invalid");
      } else {
        try {
          const scrapedDetails = await scraper.scrapeProduct(
            product.amazon_url,
            "en",
            true,
          );

          if (!scrapedDetails) {
            productIssues.push("amazon_link_unavailable");
          }
        } catch (err) {
          console.error(err.stack);
          productIssues.push("amazon_link_unavailable");
        }
      }

      // Validate other URLs
      if (product.url_list && product.url_list.length) {
        for (const urlData of product.url_list) {
          switch (urlData.source.id) {
            // Validate Ebay
            case ebaySource.id:
              if (!(await getDetailsFromEbayURL(urlData.url))) {
                productIssues.push("ebay_link_invalid");
              }
              break;

            // Validate AliExpress
            case aliexpressSource.id:
              try {
                if (!(await getDetailsFromAliExppressURL(urlData.url))) {
                  throw new Error("Invalid AlixExpress Link");
                }
              } catch (err) {
                productIssues.push("aliexpress_link_invalid");
              }
              break;
          }
        }
      }

      if (productIssues.length) {
        product.product_issues = {};

        productIssues.forEach((product_issue) => {
          product.product_issues[product_issue] = true;
        });

        // Save product as draft
        product.status = "draft";
        await strapi.services.product.updateProduct(
          product.id,
          { status: "draft", product_issues: product.product_issues },
          { price: false, amazonDetails: false },
          { change_type: "product_validator_results" }
        );

        console.error(
          `Issue(s) were found for [`.yellow +
            String(product.id).yellow.bold +
            `] ${product.title}`.yellow
        );
        productsWithIssues.push(product.id);
      } else {
        // Clear out product issues
        await strapi.services.product.updateProduct(
          product.id,
          { product_issues: null },
          { price: false, amazonDetails: false },
          { change_type: "product_validator_results" }
        );
        console.log("DONE".green);
      }
    }

    console.log(" DONE ".bgGreen.white.bold);
  } catch (err) {
    console.error(err);
  }

  scraper.close();
  process.exit();
})();
