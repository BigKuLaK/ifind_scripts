const { amazonLink } = appRequire("helpers/amazon");
const { ebayLink } = appRequire("helpers/ebay");
const { getDetailsFromURL } = appRequire("helpers/aliexpress");

/**
 * Updates links for all products using affiliate links
 * @returns [Product]
 */
module.exports = async () => {
  const allProducts = await strapi.services.product.find({ _limit: 99999 });

  // Apply updated links
  const productsWithNewLinks = [];

  for (const product of allProducts) {
    console.log(`Step 1/2: Getting updated links for ` + `[ ${product.id} ]`.bold + product.title);

    product.amazon_url = amazonLink(product.amazon_url);

    if (product.url_list && product.url_list.length) {
      await Promise.all(
        product.url_list.map(async (urlData) => {
          if (urlData.source) {
            try {
              switch (true) {
                case /ebay/i.test(urlData.source.name):
                  urlData.url = ebayLink(urlData.url);
                  break;
                case /ali/i.test(urlData.source.name):
                  const aliExpressData = await getDetailsFromURL(urlData.url);
                  urlData.url = aliExpressData.affiliateLink
                    ? aliExpressData.affiliateLink
                    : urlData.url;
                  break;
              }
            }
            catch(err) {
              console.error(err);
            }
          }
        })
      );
    }

    // Only apply updates to selected properties
    productsWithNewLinks.push({
      title: product.title,
      id: product.id,
      amazon_url: product.amazon_url,
      url_list: product.url_list,
    });

    console.log(`[ ${productsWithNewLinks.length} of ${allProducts.length} ] - Fetched new links for ${product.title}`.green);
  }

  // Save product changes
  const updatedProducts = [];
  for (let i = 0; i < productsWithNewLinks.length; i++) {
    const product = productsWithNewLinks[i];
    const { id, title, ...productData } = product;

    // Prevent lifecycle from scraping
    productData.updateScope = {
      price: false,
      amazonDetails: false,
    };

    console.log(
      `Step 2/2: Updating [ ${i + 1} of ${productsWithNewLinks.length} ] : ${id} - `.bold +
      title.cyan
    );
    const result = await strapi.services.product.update({ id }, productData);

    updatedProducts.push(result);
  }

  return updatedProducts;
};
