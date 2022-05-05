"use strict";

const preProcessCategory = require("./methods/preProcessCategory");

module.exports = {
  preProcessCategory,
  categoryTree: require("./methods/categoryTree"),
  prepopulateProductAttributes: require("./methods/prepopulateProductAttributes"),
  updateMultiple: require("./methods/updateMultiple"),
  updateProductCounts: require("./methods/updateProductCounts.js"),
};
