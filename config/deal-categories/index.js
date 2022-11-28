const glob = require("glob");
const path = require("path");

/**
 * @typedef {object} DealCategoryLabel
 * @property {number} language
 * @property {string} label
 *
 * @typedef {object} DealCategory
 * @property {boolean} [isDefault]
 * @property {Array<DealCategoryLabel>} label
 */

class DealCategoriesConfig {
  static getAll() {
    const paths = glob.sync(path.resolve(__dirname, "_*.js"));
    const dealCategories = paths.reduce(
      /**
       * @param {Object<string, DealCategory>} dealsByCategory
       * @param {string} fullPath
       * @returns Object<string, DealCategory>
       */
      (dealsByCategory, fullPath) => {
        /**
         * @type {DealCategory}
         */
        const data = require(fullPath);
        const [fileName] = fullPath.split("/").slice(-1);
        const dealCategory = fileName.replace(/^_|\..+$/g, "");

        dealsByCategory[dealCategory] = data;

        return dealsByCategory;
      },
      {}
    );

    return dealCategories;
  }
}

module.exports = DealCategoriesConfig;
