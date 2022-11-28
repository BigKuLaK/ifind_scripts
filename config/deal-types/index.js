const glob = require("glob");
const path = require("path");

/**
 * @typedef DealTypeTranslatableLabel
 * @type {object}
 * @property {string} language
 * @property {string} label
 *
 * @typedef DealTypeIcon
 * @type {object}
 * @property {string} type
 * @property {string} icon
 *
 * @typedef DealType
 * @type {object}
 * @property {string} site
 * @property {DealTypeTranslatableLabel[]} nav_label
 * @property {DealTypeIcon} nav_icon
 * @property {DealTypeTranslatableLabel} label
 * @property {string} [deal_category]
 *
 */

class DealTypesConfig {
  /**
   * @returns {Object<string, DealType>}
   */
  static getAll() {
    const paths = glob.sync(path.resolve(__dirname, "_*.js"));

    const dealTypes = paths.reduce(
      /**
       * @param {Object<string, DealType>} dealsById
       */
      (dealsById, fullPath) => {
        const data = require(fullPath);
        const [fileName] = fullPath.split("/").slice(-1);
        const dealType = fileName.replace(/^_|\..+$/g, "");

        dealsById[dealType] = data;

        return dealsById;
      },
      {}
    );

    return dealTypes;
  }
}

module.exports = DealTypesConfig;
