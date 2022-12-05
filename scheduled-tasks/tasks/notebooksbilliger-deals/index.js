const AWIN_API = require("../../../helpers/awin/api");
const { addDealsProducts } = require("../../../helpers/main-server/products");

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
};

/**@param {(import('./scraper').DealData)[]} rawDeals */
const normalizeDealsData = async (rawDeals) => {
  const finalProducts = [];

  for (const product of rawDeals) {
    const url = await AWIN_API.generateLink(
      product.url,
      NOTEBOOKSBILLIGER_HANDLE
    );

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
  console.info(
    `Sending ${products.length} new products into the main server...`.cyan
  );
  const response = addDealsProducts(notebooksbilligerDeals.id, products);
  return response.catch((err) => {
    console.error(err);
  });
};

start();
