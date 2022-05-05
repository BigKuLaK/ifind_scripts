const fetch = require("node-fetch");
const { JSDOM } = require("jsdom");
const { addURLParams, removeURLParams } = require("../helpers/url");
const createAmazonScraper = require("../helpers/amazon/amazonProductScraper");
const { scapeProduct } = require("../helpers/ebay/product-scaper");
const ebayLink = require("../helpers/ebay/ebayLink");
const amazonLink = require("../helpers/amazon/amazonLink");
// const createStrapiInstance = require("../scripts/strapi-custom");
const dealTypesConfig = require("../api/ifind/deal-types");

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
  console.log("productSummaries",productSummaries)
  for (let productSummary of productSummaries) {
    const { merchantName, productLink } = productSummary;
    console.log("merchantName---->", merchantName);
    console.log("ProductLink---->", productLink);
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
          console.log("Evay scrapper called for the product");
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
  console.log("merchantName",merchantName);
  console.log("productLink",productLink);

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

exports.getMyDealsProduct = async () => {
  console.log('Inside getMyDealsProduct');
  const merchantNamesKeys = Object.keys(MERCHANTS_NAME_PATTERN);
  const merchantNamesRegExplist = Object.values(MERCHANTS_NAME_PATTERN);
  console.log("merchantNamesRegExplist---->", merchantNamesRegExplist);
  try {
    // const strapiInstance = await createStrapiInstance();
    // [ebaySource, germanRegion] = await Promise.all([
    //   strapi.services.source.findOne({ name_contains: "ebay" }),
    //   strapi.services.region.findOne({ code: "de" }),
    // ]);
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
        console.log("merchantNameElement--->",merchantNameElement);
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

    // Remove old products
    console.info(`Removing old products...`.cyan);
    // const deletedProducts = await strapiInstance.services.product.delete({
    //   deal_type: "mydealz_highlights",
    // });
    // console.info(`Deleted ${deletedProducts.length} products(s)`.cyan);

    // Save new products
    console.log("Saving new products...".green);

    let saved = 0;

    for (const productData of scrapedProducts) {
      console.log("productData",productData);
      const newData = sanitizeScrapedData(productData);

      try {
        // await strapi.services.product.create(newData);
        console.info(
          `[ ${++saved} of ${scrapedProducts.length} ] Successfully saved: ${
            newData.title.bold
          }`.green
        );
      } catch (err) {
        console.error(err.data);
      }
    }

    console.log(" DONE ".bgGreen.white.bold);

    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
