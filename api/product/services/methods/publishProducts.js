const updateProduct = require('./updateProduct');

/**
 * Publishes all products
 * @returns [Product]
 */
 module.exports = async () => {
  const allProducts = await strapi.services.product.find({
    _limit: 99999,
    status: 'draft',
  });

  // Extract and set published data for each product
  const updatedProductsData = allProducts.map((product) => {
    // Only apply updates to selected properties
    return {
      id: product.id,
      status: 'published',
    };
  });

  // Then, save all these updated products,
  // Returning the full data for each product
  const savedProducts = [];

  for (const newData of updatedProductsData) {
    const { id, ...productData } = newData;

    try {
      const result = await updateProduct(
        id,
        productData,
        {
          price: false,
          amazonDetails: false,
        },
      )

      const count = savedProducts.push(result);
      console.log(
        `Published ${count} of ${updatedProductsData.length} [${id}]`.green.bold,
        result.title
      );
    } catch (err) {
      console.log(`Error in ${id}`.bgRed.white.bold, productData);
      console.error(err);
    }
  }

  return savedProducts;
};
