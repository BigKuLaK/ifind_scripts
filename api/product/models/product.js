"use strict";

const {
  preProcessProductData,
  applyProductCategoryUpdates,
  saveProductChange,
} = require("../services/product");

module.exports = {
  lifecycles: {
    async beforeCreate(data) {
      await preProcessProductData(data);
    },
    async beforeUpdate(params, data) {
      await preProcessProductData(data, params.id);
    },
    async afterCreate(result) {
      await applyProductCategoryUpdates(result.id);
      await saveProductChange(result.id, "create");
    },
    async afterUpdate(result) {
      await applyProductCategoryUpdates(result.id);
      await saveProductChange(result.id);
    },
  },
};
