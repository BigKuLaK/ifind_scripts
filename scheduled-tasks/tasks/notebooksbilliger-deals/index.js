const AWIN_API = require("../../../helpers/awin/api");
const { prerender } = require("../../../helpers/main-server/prerender");
const { addDealsProducts } = require("../../../helpers/main-server/products");
const { saveLastRunFromProducts } = require("../../utils/task");
const pause = require("../../../helpers/pause");

const DealTypes = require("../.././../ifind-utilities/airtable/models/deal_types");
const Sites = require("../.././../ifind-utilities/airtable/models/sites");

/**@type {import('../../../helpers/awin/_advertisers').AdvertiserHandles} */
const NOTEBOOKSBILLIGER_HANDLE = "notebooksbilliger";

const NotebooksBilligerScraper = require("./scraper");

let notebooksbilligerDealType;

const start = async () => {
  await getInitialData();

  /**@type {(import('./scraper').DealData)[]} */
  const deals = await NotebooksBilligerScraper.getDeals();

  /**@type {(import('../../../config/typedefs/product').Product)[]} */
  const productsData = await normalizeDealsData(deals);

  const products = await addDealsProducts(
    notebooksbilligerDealType.id,
    productsData
  );

  await Promise.all([
    // Trigger prerender
    await prerender(),
    // Save task data
    await saveLastRunFromProducts(process.env.taskRecord, products),
  ]);
};

const getInitialData = async () => {
  const [dealTypes, sites] = await Promise.all([DealTypes.all(), Sites.all()]);

  notebooksbilligerDealType = dealTypes.find(({ fields }) =>
    /notebooksbilliger/i.test(fields.id)
  )?.fields;

  if (notebooksbilligerDealType) {
    const notebooksbilligerSite = sites.find(({ fields }) =>
      /notebooksbilliger/i.test(fields.id)
    );
    notebooksbilligerDealType.site = notebooksbilligerSite?.get("id");
  }
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

    const priceOld = Number(
      String(product.priceOld).replace(/[.,]/g, (match) =>
        match === "." ? "" : "."
      )
    );
    const priceCurrent = Number(
      String(product.priceCurrent).replace(/[.,]/g, (match) =>
        match === "." ? "" : "."
      )
    );

    /**@type {import("../../../config/typedefs/product").Product} */
    const newProductData = {
      title: product.title,
      image: product.image,
      deal_type: notebooksbilligerDealType.id,
      url_list: [
        {
          url,
          price: priceCurrent,
          price_original: priceCurrent === priceOld ? undefined : priceOld,
          discount_percent:
            priceCurrent === priceOld
              ? 0
              : Math.round(100 * (1 - priceCurrent / priceOld)),
        },
      ],
    };
    console.log({ newProductData: newProductData.url_list[0] });
    finalProducts.push(newProductData);
  }

  return finalProducts;
};

start();
