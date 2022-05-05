/**
 * Retrieves product details for a given product ID
 * Includes: details_html, product_changes, url_list, etc.
 * @param {ID} productID
 * @param {Strin} language - The target language code
 * @returns Object
 */
module.exports = async (productID, language = "en") => {
  if (productID) {
    const productDetails = await strapi.services.product.findOne({
      id: productID,
    });
    return productDetails;
  }

  return "";
};
