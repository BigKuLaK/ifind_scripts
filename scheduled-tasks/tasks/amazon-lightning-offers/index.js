const getLightningOffers = require("../../../helpers/amazon/lightning-offers");
const createAmazonProductScraper = require("../../../helpers/amazon/amazonProductScraper");
const amazonLink = require("../../../helpers/amazon/amazonLink");
const axios = require('axios').default;
const endpoint = "https://www.ifindilu.de/graphql";
// const endpoint = "http://localhost:1337/graphql";
// const endpoint = "https:///167.99.136.229/graphql";
const RETRY_WAIT = 10000;
const DEAL_TYPE = "amazon_flash_offers";
const PRODUCTS_TO_SCRAPE = null;

// Get Region Source
async function getRegionSources() {
  console.log("inside getRegionSources")
  const headers = {
    "content-type": "application/json",
  };
  const graphqlQuery = {
    "query": `{
      amazonSource: sources(where:{ name_contains: "amazon_2" }) {
        id
      }
      germanRegion: regions(where:{ code:"de" }) {
        id
      }
    }`,
  }

  try {
    const response = await axios({
      url: endpoint,
      method: 'post',
      headers: headers,
      data: graphqlQuery
    })
    source = response.data.data.amazonSource[0].id
    region = response.data.data.germanRegion[0].id
  } catch (e) {
    console.log("Error : ", e);
  }
}

(async () => {
  console.log("Inside getAmazonProducts task");
  const productScraper = await createAmazonProductScraper();
  console.log("Product Scrapper created");
  try {
    let offerProducts = [];
    let tries = 0;
    await getRegionSources();
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
        // To be removed
          console.log("Product URL : ", productData.url);

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
      console.log("Products Fetched : ");
      console.log(scrapedProducts);
      // const finalProducts = [];
      // for (const product of scrapedProducts) {
      //   const newData = {
      //     title: product.title,
      //     image: product.image,
      //     website_tab: "home",
      //     deal_type: DEAL_TYPE,
      //     amazon_url: product.amazon_url,
      //     url_list: {
      //       source: source,
      //       region: region,
      //       // url: product.url,
      //       url: product.amazon_url,
      //       price: product.price,
      //       price_original: product.price_original,
      //       discount_percent: product.discount_percent,
      //       quantity_available_percent: product.quantity_available_percent
      //     }
      //   }
      //   // To be removed
      //   console.log("NewData : ", newData);

      //   finalProducts.push(newData)
      // }
      console.log("scrapedProducts Length",scrapedProducts.length)
      console.log("scrapedProducts",scrapedProducts)
      const headers = {
        "content-type": "application/json",
      };
      const graphqlQuery = {
        "query": `mutation AddNewProducts ($deal_type:String!, $products: [ProductInput]) {
          addProductsByDeals( deal_type: $deal_type, products:$products ){
            id
            title
          }
        }
        `,
        "variables": {
          "deal_type": DEAL_TYPE,
          "products": scrapedProducts
        }
      }
      const response = await axios({
        url: endpoint,
        method: 'POST',
        headers: headers,
        data: graphqlQuery
      })
      console.log("Graphql endpoint status", response.status);
    }
    console.log(" DONE ".bgGreen.white.bold);
    productScraper.close();
    process.exit();
  } catch (err) {
    console.error(err.message);
    productScraper.close();
    throw err;
  }
})();
