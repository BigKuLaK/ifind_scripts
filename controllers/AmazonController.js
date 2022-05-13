// const createStrapiInstance = require("../../../scripts/strapi-custom");
const getLightningOffers = require("../helpers/amazon/lightning-offers");
const createAmazonProductScraper = require("../helpers/amazon/amazonProductScraper");
const amazonLink = require("../helpers/amazon/amazonLink");
const RETRY_WAIT = 10000;
const DEAL_TYPE = "amazon_flash_offers";
const PRODUCTS_TO_SCRAPE = null;
const endpoint = "https://www.ifindilu.de/graphql";
let [source, region] = ""

// Function for getting regions using graphQL endpoints

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

// Function for delete products using graphQL endpoints

async function deleteAmazonData() {
  console.log("deleteAmazonData")

  const headers = {
    "content-type": "application/json",
  };
  const graphqlQuery = {
    "query": `mutation  DeleteProductsByDeals($deal_type: String) {
      deleteProductsByDeals(deal_type: $deal_type)}`,
    "variables": {
      "deal_type": DEAL_TYPE
    }
  }
  try {
    const response = await axios({
      url: endpoint,
      method: 'post',
      headers: headers,
      data: graphqlQuery
    })

  } catch (e) {
    console.log("Error : ", e);
  }
}

// Function for Add products using graphQL endpoints

async function addAmazonData(product) {
  console.log("addAmazonData")
  await getRegionSources();

  const headers = {
    "content-type": "application/json"
  }
  const graphqlQuery = {
    query: `mutation CreateProduct(
      $deal_type: ENUM_PRODUCT_DEAL_TYPE!
      $amazon_url: String!
      $title: String!
      $image: String!
      $url_list: [ComponentAtomsUrlWithTypeInput]
    ) {
      createProduct(
        input: {
          data: {
            image: $image
            title: $title
            amazon_url: $amazon_url
            website_tab: "home"
            deal_type: $deal_type
            url_list: $url_list
          }
        }
      ) {
        product {
          id
        }
      }
    }`,
    variables: {
      image: product.image,
      title: product.title,
      amazon_url: product.amazon_url,
      website_tab: "home",
      deal_type: DEAL_TYPE,
      url_list: [
        {
          url: product.url,
          source: source,
          region: region,
          price: product.price,
          price_original: product.price_original,
          discount_percent: product.discount_percent,
        },
      ],
    }
  }
  try {

    const response = await axios({
      url: endpoint,
      method: 'post',
      headers: headers,
      data: graphqlQuery
    })
  }
  catch (e) {
    console.log("Error in add API  : ", e);
  }
}

exports.getAmazonProducts = async (req, res) => {
  console.log("Inside getAmazonProducts");
  const productScraper = await createAmazonProductScraper();
  console.log("Product Scrapper created ()");
  try {
    let offerProducts = [];
    let tries = 0;
    let savedProducts = 0;
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
      if (scrapedProducts.length > 0) {
        console.log("Sending request to delete products from main server ");
        await deleteAmazonData();


        for (const product of scrapedProducts) {

          console.log("Add Ebay Productss")
          await addAmazonData(product);

        }
        return res.status(200).json({
          success: true,
        })
      }
    }
    else {
      console.log('No products were fetched.'.red.bold);
    }
    productScraper.close();
  } catch (err) {
    console.error(err.message);
    productScraper.close();
    throw err;
  }
};
