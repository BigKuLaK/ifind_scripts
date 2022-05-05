const { updateCategoryProductsCount } = appRequire("helpers/category");

/**
 * Calls category update for products_count
 * @param {ID} productID
 * @returns void
 */
module.exports = async (productID) => {
  const matchedProduct = await strapi.services.product.findOne({
    id: productID,
  });

  if (
    !matchedProduct ||
    !matchedProduct.category ||
    !matchedProduct.category.id
  ) {
    return null;
  }

  await updateCategoryProductsCount(matchedProduct.category.id);
};
