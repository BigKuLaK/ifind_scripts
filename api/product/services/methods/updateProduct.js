const { initialState } = appRequire("helpers/redux/product-change");
const { setProductChangeParams } = appRequire("helpers/redux");

/**
 * Wraps strapi.services.product.update
 * In order to implement our custom logic.
 */
module.exports = async (
  id,
  data = {},
  scope = {},
  productChangeParams = initialState.productChangeParams
) => {
  // { admin_user, state, change_type }
  setProductChangeParams({
    ...productChangeParams,
    state: data,
  });

  return await strapi.services.product.update(
    { id },
    { ...data, updateScope: scope }
  );
};
