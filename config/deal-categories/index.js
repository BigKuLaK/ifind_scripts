const glob = require("glob");
const path = require("path");
const { getAll: getAllDealTypes } = require("../deal-types");

/**
 * @typedef {object} DealCategoryLabel
 * @property {number} language
 * @property {string} label
 *
 * @typedef {object} DealCategory
 * @property {boolean} [isDefault]
 * @property {Array<DealCategoryLabel>} label
 */

const categoriesOrder = [
  "warehouse",
  "fashion",
  "electronics",
  "grocery",
  "hobby",
  "health",
  "furniture",
  "travel",
  "children",
];

class DealCategoriesConfig {
  static getAll() {
    // Get dealtypes first
    const dealTypes = getAllDealTypes();

    const dealCategories = categoriesOrder.reduce(
      /**
       * @param {Object<string, DealCategory>} dealsByCategory
       * @param {string} fullPath
       * @returns {Object<string, DealCategory>}
       */
      (dealsByCategory, dealCategory) => {
        /**
         * @type {DealCategory}
         */
        const data = require(path.resolve(__dirname, `_${dealCategory}.js`));

        dealsByCategory[dealCategory] = {
          id: dealCategory,
          ...data,
        };

        // Get deal types for this dealCategory
        const matchedDealTypes = Object.values(dealTypes)
          .filter(({ deal_category }) => deal_category === dealCategory)
          .map(({ id }) => id);

        dealsByCategory[dealCategory].dealTypes = matchedDealTypes;

        return dealsByCategory;
      },
      {}
    );

    return dealCategories;
  }
}

module.exports = DealCategoriesConfig;
