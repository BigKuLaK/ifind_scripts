const fetch = require("node-fetch");
const { JSDOM } = require("jsdom");
const { addURLParams, removeURLParams } = require("../../../helpers/url");
const createAmazonScraper = require("../../../helpers/amazon/amazonProductScraper");
const { scapeProduct } = require("../../../helpers/ebay/product-scaper");
const ebayLink = require("../../../helpers/ebay/ebayLink");
const amazonLink = require("../../../helpers/amazon/amazonLink");
const createStrapiInstance = require("../../../scripts/strapi-custom");
const dealTypesConfig = require("../../../api/ifind/deal-types");

const MYDEAL_DEAL_ID = Object.entries(dealTypesConfig).find(
  ([dealID, dealTypeConfig]) => /mydealz/i.test(dealTypeConfig.site)
)[0];
const MYDEALZ_URL = "https://www.mydealz.de";
const MAX_PRODUCTS = 50;

const PRODUCT_CARD_SELECTOR = ".cept-thread-item";
const PRODUCT_MERCHANT_SELECTOR = ".cept-merchant-name";
const PRODUCT_DEAL_LINK_SELECTOR = ".cept-dealBtn";

let ebaySource, germanRegion;

const MERCHANTS_NAME_PATTERN = {
  amazon: /^amazon$/i,
  ebay: /^ebay$/i,
};

const getProductDetails = async (productSummaries) => {
  const scrapedProducts = [];

  for (let productSummary of productSummaries) {
    const { merchantName, productLink } = productSummary;

    try {
      switch (merchantName) {
        case "amazon":
          const amazonScraper = await createAmazonScraper();
          scrapedProducts.push({
            ...(await amazonScraper.scrapeProduct(productLink)),
            productLink,
            merchantName,
          });
          break;

        case "ebay":
          scrapedProducts.push({
            ...(await scapeProduct(productLink)),
            productLink,
            merchantName,
          });
          break;

        default:
          break;
      }
    } catch (err) {
      console.error(`Error while scraping ${productLink.bold}`);
      console.error(err);
    }
  }

  return scrapedProducts;
};

const sanitizeScrapedData = ({ merchantName, productLink, ...productData }) => {
  productData.website_tab = "home";
  productData.deal_type = MYDEAL_DEAL_ID;
  productData.deal_merchant = merchantName;
  productData.deal_quantity_available_percent =
    productData.quantity_available_percent;

  switch (merchantName) {
    case "ebay":
      productData.url_list = [
        {
          source: ebaySource.id,
          region: germanRegion.id,
          url: ebayLink(productLink),
          price: productData.price,
          price_original: productData.price_original,
          discount_percent: productData.discount_percent,
          quantity_available_percent: productData.quantity_available_percent,
        },
      ];
      break;
    case "amazon":
      productData.amazon_url = amazonLink(productLink);
      break;
  }

  return productData;
};

(async () => {
  const merchantNamesKeys = Object.keys(MERCHANTS_NAME_PATTERN);
  const merchantNamesRegExplist = Object.values(MERCHANTS_NAME_PATTERN);

  try {

    await axios.post("http://164.90.181.113:3000/mydealz/getMyDealsProduct").then(
      (response) => {
        scrapedProducts = response.data.data;
      },
      (error) => {
        console.log(error);
      }
    );
    console.info(`Getting to mydealz page ${page}`.cyan);
    console.info("Getting product links".cyan);
    console.info(`Removing old products...`.cyan);
    console.log("Saving new products...".green);
    console.log(" DONE ".bgGreen.white.bold);

    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
