/**
 * Increments a product's clicks_count value.
 * @param {ID} productID
 * @returns Object
 */
module.exports = async (productID) => {
  if ( !productID ) {
    return null;
  }

  const matchedProduct = await strapi.services.product.findOne({ id: productID });

  if ( !matchedProduct ) {
    return null;
  }

  // Increment clicks count
  const clicks_count = Number(matchedProduct.clicks_count) + 1;

  // Update product
  await strapi.services.product.update({ id: productID }, {
    clicks_count,
    updateScope: {
      price: false,
      amazonDetails: false,
    }
  });

  return {
    id: productID,
    clicks_count
  };
}
