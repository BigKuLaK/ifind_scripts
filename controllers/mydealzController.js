const fetch = require("node-fetch");
const { JSDOM } = require("jsdom");
const { addURLParams, removeURLParams } = require("../helpers/url");
const createAmazonScraper = require("../helpers/amazon/amazonProductScraper");
const { scapeProduct } = require("../helpers/ebay/product-scaper");
const ebayLink = require("../helpers/ebay/ebayLink");
const amazonLink = require("../helpers/amazon/amazonLink");
// const createStrapiInstance = require("../scripts/strapi-custom");
const dealTypesConfig = require("../api/ifind/deal-types");
const MYDEALZ_DEAL_TYPE = "mydealz_highlights" //For deleting data only.
const endpoint = "https://www.ifindilu.de/graphql"
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

// Function to delete Data using graphql Endpoint
async function deleteMyDealzData() {
  const headers = {
    "content-type": "application/json",
  };
  const graphqlQuery = {
    "query": `mutation  DeleteProductsByDeals($deal_type: String) {
      deleteProductsByDeals(deal_type: $deal_type)}`,
    "variables": {
      "deal_type": MYDEALZ_DEAL_TYPE
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

// Function to add scraped data into Strapi database using Graphql Endpoints
async function addMyDealzData(merchantName, productLink, ...product) {
  await getRegionSources();
  const headers = {
    "content-type": "application/json"
  }
  let graphqlQuery
  switch (merchantName) {
    case "ebay":
      graphqlQuery = {
        query: `mutation CreateProduct(
          $deal_type: ENUM_PRODUCT_DEAL_TYPE!
          $title: String!
          $image: String!
          $url_list: [ComponentAtomsUrlWithTypeInput]
        ) {
          createProduct(
            input: {
              data: {
                image: $image
                title: $title
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
          website_tab: "home",
          deal_type: MYDEAL_DEAL_ID,
          url_list: [
            {
              url: ebayLink(productLink),
              source: parseINT(ebaySource),
              region: parseINT(germanRegion),
              price: product.price,
              price_original: product.price_original,
              discount_percent: product.discount_percent,
              quantity_available_percent: product.quantity_available_percent,
            },
          ],
        }
      }
      break;
    case "amazon":
      graphqlQuery = {
        query: `mutation CreateProduct(
          $deal_type: ENUM_PRODUCT_DEAL_TYPE!
          $title: String!
          $image: String!
          $amazon_url : String!
          $url_list: [ComponentAtomsUrlWithTypeInput]
        ) {
          createProduct(
            input: {
              data: {
                image: $image
                title: $title
                website_tab: "home"
                deal_type: $deal_type
                url_list: $url_list
                amazon_url:$amazon_url
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
          website_tab: "home",
          deal_type: MYDEAL_DEAL_ID,
          amazon_url: amazonLink(productLink),
          url_list: [
            {
              url: product.url,
              source: parseINT(ebaySource),
              region: parseINT(germanRegion),
              price: product.price,
              price_original: product.price_original,
              discount_percent: product.discount_percent,
              quantity_available_percent: product.quantity_available_percent,
            },
          ],
        }
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

const getProductDetails = async (productSummaries) => {
  const scrapedProducts = [];
  for (let productSummary of productSummaries) {
    const { merchantName, productLink } = productSummary;
    try {
      switch (merchantName) {
        case "amazon":
          console.log("Amazon scrapper called for the product");
          const amazonScraper = await createAmazonScraper();
          scrapedProducts.push({
            ...(await amazonScraper.scrapeProduct(productLink)),
            productLink,
            merchantName,
          });
          break;

        case "ebay":
          console.log("Ebay scrapper called for the product");
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
  console.log("merchantName", merchantName);
  console.log("productLink", productLink);

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

exports.getMyDealsProduct = async (req, res) => {
  console.log("Inside getMyDealsProduct");
  const merchantNamesKeys = Object.keys(MERCHANTS_NAME_PATTERN);
  const merchantNamesRegExplist = Object.values(MERCHANTS_NAME_PATTERN);
  try {
    console.log("Inside getMYDealsProduct API");
    const scrapedProducts = [];
    // Cache product links to check for duplicate products
    const productLinks = [];
    let page = 1;
    let morePageAvailable = true;

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

    if (scrapedProducts.length > 0) {
      await deleteMyDealzData();
      let saved = 0;
      for (const product of scrapedProducts) {
        await addMyDealzData(product)
        console.info(
          `[ ${++saved} of ${scrapedProducts.length} ] Successfully saved: ${product.title.bold
            }`.green
        );
      }
    } else {
      console.info("NO Products were fetched while srapping".red);
    }

    console.log(" DONE ".bgGreen.white.bold);
    return res.status(200).json({
      success: true,
      msg: "Data added successfully"
    });
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};
