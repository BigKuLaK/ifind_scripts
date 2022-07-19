require("../../../helpers/customGlobals");

const fetch = require("node-fetch");
const fs = require('fs-extra');
const { JSDOM } = require("jsdom");
const path = require("path");

const { addURLParams, removeURLParams } = appRequire("helpers/url");
const createAmazonScraper = appRequire("helpers/amazon/amazonProductScraper");
const { scrapeProduct } = require("../../../helpers/ebay/product-scraper");
const ebayLink = appRequire("helpers/ebay/ebayLink");
const amazonLink = appRequire("helpers/amazon/amazonLink");
const dealTypesConfig = appRequire("api/ifind/deal-types");
const { query } = appRequire("helpers/main-server/graphql");
const { getSourceRegion } = require('../../../helpers/main-server/sourceRegion');
const { addDealsProducts } = appRequire("helpers/main-server/products");
const Logger = require("../../lib/Logger");

const MYDEAL_DEAL_ID = Object.entries(dealTypesConfig).find(
  ([dealID, dealTypeConfig]) => /mydealz/i.test(dealTypeConfig.site)
)[0];
const MYDEALZ_DEAL_TYPE = "mydealz_highlights";
const MYDEALZ_URL = "https://www.mydealz.de";
const MAX_PAGE = 50;
const MAX_PRODUCTS = 100;
const START = "start";
const STOP = "stop";

const PRODUCT_CARD_SELECTOR = ".cept-thread-item";
const PRODUCT_TITLE_SELECTOR = ".thread-title ";
const PRODUCT_MERCHANT_SELECTOR = ".cept-merchant-name";
const PRODUCT_DEAL_LINK_SELECTOR = "a.btn--mode-primary";
let ebaySource, germanRegion;
let ReceivedLogs = null;

let amazonScraper;

const MERCHANTS_NAME_PATTERN = {
  amazon: /^amazon$/i,
  ebay: /^ebay$/i,
};

// Function to get source and region
async function getRegionSources() {
  try {
    const { source, region } = await getSourceRegion('ebay', 'de');
    ebaySource = source.id;
    germanRegion = region.id;
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
          console.info(`Scraping Amazon product: ${productLink}`.magenta);
          scrapedProducts.push({
            ...(await amazonScraper.scrapeProduct(productLink)),
            productLink,
            merchantName,
          });
          break;

        case "ebay":
          console.info(`Scraping eBay product: ${productLink}`.magenta);
          scrapedProducts.push({
            ...(await scrapeProduct(productLink)),
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

const getLogs = async () => {
  const res = await query(`{prerendererLogs {
    type
    date_time
    message
  }}`);
  ReceivedLogs = res.data.data.prerendererLogs;
  return function () {
    console.log("call back function");
  };
};
const LOGGER = new Logger({ context: 'mydealz-highlights' });

(async () => {
  console.log("Inside getMyDealsProduct Task");

  amazonScraper = await createAmazonScraper();

  const merchantNamesKeys = Object.keys(MERCHANTS_NAME_PATTERN);
  const merchantNamesRegExplist = Object.values(MERCHANTS_NAME_PATTERN);
  try {
    const scrapedProducts = [];
    // Cache product links to check for duplicate products
    const productLinks = [];
    const fetchedProducts = [];

    let page = 1;
    let morePageAvailable = true;
    await getRegionSources();

    while (scrapedProducts.length < MAX_PRODUCTS && morePageAvailable && page <= MAX_PAGE) {
      console.info(`Getting to mydealz page ${page}`.cyan);
      let response, fetchTries = 5;

      const pageURL = addURLParams(MYDEALZ_URL, { page });

      while ( fetchTries && !response ) {
        try {
          response = await fetch(pageURL);
        } catch (err) {
          console.warn(err.message);
          fetchTries--;
        }
      }

      if ( !response ) {
        console.info(`Unable to fetch page ${page} due to error, skipping.`.red.bold);
        page++;
        continue;
      }

      const bodyHtml = await response.text();

      /* Uncomment the block below if screenshots are needed */
      // const screenshotDir = path.resolve(__dirname, '../../../helpers/mydealz/screenshots');
      // fs.mkdirSync(screenshotDir, { recursive: true });
      // fs.outputFileSync(path.resolve(screenshotDir, `page-${page}.html`), bodyHtml);

      const {
        window: { document },
      } = new JSDOM(bodyHtml);

      const products = Array.from(
        document.querySelectorAll(PRODUCT_CARD_SELECTOR)
      );

      // Select only products from selected merchants
      const filteredProducts = products.filter((productElement) => {
        const merchantNameElement = productElement.querySelector(
          PRODUCT_MERCHANT_SELECTOR
        );
        const merchantName = merchantNameElement
          ? merchantNameElement.textContent.trim()
          : "";
        return merchantNamesRegExplist.some((matcher) =>
          matcher.test(merchantName)
        );
      });

      console.info(`Getting product links for ${filteredProducts.length} product(s)`.cyan);

      for (productElement of filteredProducts) {
        const merchantNameText = productElement
          .querySelector(PRODUCT_MERCHANT_SELECTOR)
          .textContent.trim();
        const merchantName = merchantNamesKeys.filter((merchantNameKey) =>
          MERCHANTS_NAME_PATTERN[merchantNameKey].test(merchantNameText)
        )[0];
        const productTitle = productElement
          .querySelector(PRODUCT_TITLE_SELECTOR)
          .textContent.trim();
        const productLinkElement = productElement.querySelector(
          PRODUCT_DEAL_LINK_SELECTOR
        );
        const dealLink = productLinkElement
          ? productLinkElement.getAttribute("href")
          : "";

        if (dealLink) {
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
      }

      // Delay next page request to prevent reaching request limit
      await new Promise(resolve => setTimeout(resolve, 1000));

      page++;
    }
    const sanitizedData = [];

    // Fetch product details
    if (fetchedProducts.length) {
      console.log({
        PRODUCT_LINKS: fetchedProducts.map(({ productLink }) => productLink),
      });

      console.info(
        `Getting details for ${fetchedProducts.length} product(s)`.cyan
      );
      const productDetails = await getProductDetails(fetchedProducts);
      scrapedProducts.push(...productDetails);
    } else {
      console.info(`No products fetched`);
    }


    for (const productData of scrapedProducts) {
      sanitizedData.push(sanitizeScrapedData(productData));
    }

    console.log("Products Fetched : ", sanitizedData.length);
    console.log("Saving new products...".green);

    const response = await addDealsProducts(MYDEALZ_DEAL_TYPE, sanitizedData);
    console.log("Graphql Endpoint response", response.status);

    if (response.status == 200) {
      try {
        const prerender = await query(
          `
          mutation Prerenderer($command:PRERENDERER_COMMAND!) {
            prerenderer( command: $command )
          }
          `,
          {
            command: START,
          }
        );
        console.log(
          "Response of prerender graphql endpoint : ",
          prerender.status
        );
        if (prerender.status == 200) {
          console.log("Getting prerender logs from main server");
          // Get prerender logs from main server
          // setTimeout(async () => {
          await getLogs();
          // }, 1000);
          // await getLogs();
          if (ReceivedLogs != null) {
            for (const i of ReceivedLogs) {
              console.log(i.message);
              LOGGER.log(i.message);
            }
          }
          LOGGER.log("Prerender logs added into logger");
        }
      } catch (e) {
        console.log("Error in Ebay task : ", e);
      }
    } else {
      console.log("prerender not triggered in main server ");
    }
    console.log(" DONE ".bgGreen.white.bold);
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
