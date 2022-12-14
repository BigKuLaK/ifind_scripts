const AWIN_API = require("../../../helpers/awin/api");
const { prerender } = require("../../../helpers/main-server/prerender");
const { addDealsProducts } = require("../../../helpers/main-server/products");
const pause = require("../../../helpers/pause");

/**@type {import('../../../helpers/awin/_advertisers').AdvertiserHandles} */
const NOTEBOOKSBILLIGER_HANDLE = "notebooksbilliger";
const notebooksbilligerDeals = require("../../../config/deal-types").match(
  /notebooksbilliger/i
);

const NotebooksBilligerScraper = require("./scraper");

const start = async () => {
  /**@type {(import('./scraper').DealData)[]} */
  const deals = await NotebooksBilligerScraper.getDeals();

  /**@type {(import('../../../config/typedefs/product').Product)[]} */
  const productsData = await normalizeDealsData(deals);

  const response = await sendProducts(productsData);

  // Trigger prerender
  const prerenderer = await prerender();

  console.log({ prerenderer });
};

/**@param {(import('./scraper').DealData)[]} rawDeals */
const normalizeDealsData = async (rawDeals) => {
  const finalProducts = [];

  // Get affiliate links for multiple products
  const affiliateLinksData = await AWIN_API.generateLinks(
    rawDeals.map(({ url }) => url),
    NOTEBOOKSBILLIGER_HANDLE
  );

  for (const product of rawDeals) {
    // Use matching affiliate link if there is any
    // otherwise, use the original URL
    const url =
      affiliateLinksData.find(
        ({ destinationUrl }) => destinationUrl === product.url
      )?.url || product.url;

    /**@type {import("../../../config/typedefs/product").Product} */
    const newProductData = {
      title: product.title,
      image: product.image,
      deal_type: notebooksbilligerDeals.id,
      url_list: [
        {
          url,
          price: product.priceOld,
          price_original: product.priceCurrent,
          discount_percent: product.discount,
          merchant: notebooksbilligerDeals.site,
        },
      ],
    };
    finalProducts.push(newProductData);
  }

  return finalProducts;
};

/**@param {(import('../../../config/typedefs/product').Product)[]} products */
const sendProducts = async (products) => {
  pause(1000);
  console.info(
    `Sending ${products.length} new products into the main server...`.cyan
  );

  console.log(products[0]);
  const response = addDealsProducts(notebooksbilligerDeals.id, products);
  return await response.catch((err) => {
    console.error(err);
  });
};

start();
