/**
 * Prepopulates product_attrs property for a category
 * @param {Category} category
 * @returns {Category}
 */
module.exports = async (category) => {
  // Get product attributes
  const productAttributes = await strapi.services[
    "product-attribute"
  ].getCommon();

  // Map to existing category's product_attributes settings
  const catProdAttrsList = productAttributes.map((productAttribute) => {
    const matchedCatAttr = category.product_attrs.find(
      ({ product_attribute }) =>
        productAttribute.id === (product_attribute && product_attribute.id)
    );

    // Update existing
    if (matchedCatAttr) {
      return {
        id: matchedCatAttr.id,
        product_attribute: productAttribute,
        label_preview: `${productAttribute.name} (${matchedCatAttr.factor})`,
        factor: matchedCatAttr.factor,
      };
    }
    // Add new
    else {
      return {
        product_attribute: productAttribute,
        label_preview: `${productAttribute.name} (1)`,
        factor: 1,
      };
    }
  });

  // Sort according to factor in descending order
  catProdAttrsList.sort((attrA, attrB) =>
    attrA.factor > attrB.factor ? -1 : 1
  );

  // Replace with updated attributes
  category.product_attrs = catProdAttrsList;

  return category;
};
