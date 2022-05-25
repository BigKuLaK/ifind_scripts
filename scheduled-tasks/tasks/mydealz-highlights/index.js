const fetch = require("node-fetch");
const { JSDOM } = require("jsdom");
const { addURLParams, removeURLParams } = require("../../../helpers/url");
const createAmazonScraper = require("../../../helpers/amazon/amazonProductScraper");
const { scapeProduct } = require("../../../helpers/ebay/product-scaper");
const ebayLink = require("../../../helpers/ebay/ebayLink");
const amazonLink = require("../../../helpers/amazon/amazonLink");
const dealTypesConfig = require("../../../api/ifind/deal-types");
const endpoint = "https://www.ifindilu.de/graphql";

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

// Function to get source and region
async function getRegionSources() {
  console.log("inside getRegionSources")
  const headers = {
    "content-type": "application/json",
  };
  const graphqlQuery = {
    "query": `{
       ebaySource: sources(where:{ name_contains: "ebay" }) {
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
    console.log("Region ", response.data.data.germanRegion[0].id);
    console.log("Source ", response.data.data.ebaySource[0].id);
    ebaySource = response.data.data.ebaySource[0].id;
    germanRegion = response.data.data.germanRegion[0].id
  } catch (e) {
    console.log("Error : ", e);
  }
}
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
          source: ebaySource,
          region: germanRegion,
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
  console.log("Inside getMyDealsProduct Task");
  const merchantNamesKeys = Object.keys(MERCHANTS_NAME_PATTERN);
  const merchantNamesRegExplist = Object.values(MERCHANTS_NAME_PATTERN);
  try {

    const scrapedProducts = [];
    // Cache product links to check for duplicate products
    const productLinks = [];
    let page = 1;
    let morePageAvailable = true;
    await getRegionSources();
    while (scrapedProducts.length < MAX_PRODUCTS && morePageAvailable) {
      const fetchedProducts = [];

      console.info(`Getting to mydealz page ${page}`.cyan);
      const response = await fetch(addURLParams(MYDEALZ_URL, { page }));
      const bodyHtml = await response.text();
      const {
        window: { document },
      } = new JSDOM(bodyHtml);

      console.info("Getting product links".cyan);
      console.log("Product_Card_selector", PRODUCT_CARD_SELECTOR);
      const products = Array.from(
        document.querySelectorAll(PRODUCT_CARD_SELECTOR)
      );
      console.log("Products--->", products);

      // Select only products from selected merchants
      const filteredProducts = products.filter((productElement) => {
        const merchantNameElement = productElement.querySelector(
          PRODUCT_MERCHANT_SELECTOR
        );
        console.log("merchantNameElement--->", merchantNameElement);
        const merchantName = merchantNameElement
          ? merchantNameElement.textContent.trim()
          : "";
        return merchantNamesRegExplist.some((matcher) =>
          matcher.test(merchantName)
        );
      });

      for (productElement of filteredProducts) {
        const merchantNameText = productElement
          .querySelector(PRODUCT_MERCHANT_SELECTOR)
          .textContent.trim();
        const merchantName = merchantNamesKeys.filter((merchantNameKey) =>
          MERCHANTS_NAME_PATTERN[merchantNameKey].test(merchantNameText)
        )[0];
        console.log("Product Element --->", productElement);
        const dealLink = productElement
          .querySelector(PRODUCT_DEAL_LINK_SELECTOR)
          .getAttribute("href");
        console.log("dealLink", dealLink);
        const productLink = removeURLParams((await fetch(dealLink)).url);

        // If a product link is already present,
        // that means we reached the end of the pagination
        // and no more products available
        if (productLinks.includes(productLink)) {
          morePageAvailable = false;
          break;
        }

        productLinks.push(productLink);

        fetchedProducts.push({
          merchantName,
          productLink,
        });
      }

      if (fetchedProducts.length) {
        console.info(
          `Getting details for ${fetchedProducts.length} product(s)`.cyan
        );
        const productDetails = await getProductDetails(fetchedProducts);
        scrapedProducts.push(...productDetails);
      } else {
        console.info(`No products fetched`);
      }
      page++;
    }
    const sanitizedData = [];
    for (const productData of scrapedProducts) {
      sanitizedData.push(sanitizeScrapedData(productData));
    }
    console.log("Products Fetched : ",sanitizedData.length);
    console.log("Saving new products...".green);
    const headers = {
      "content-type": "application/json",
    };
    const graphqlQuery = {  
      "query" : `mutation AddNewProducts ($deal_type:String!, $products: [ProductInput]) {
        addProductsByDeals( deal_type: $deal_type, products:$products ){
          id
          title
        }
      }
      `,
      "variables" : {
        "deal_type": MYDEALZ_DEAL_TYPE,
        "products" : sanitizedData
      }
    }
    const response = await axios({
      url:endpoint,
      method:'POST',
      headers : headers,
      data: graphqlQuery 
    })
    console.log("Graphql Endpoint response", response.status);
    console.log(" DONE ".bgGreen.white.bold);
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
