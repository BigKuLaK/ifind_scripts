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
  static getAll(asArray = false) {
    const paths = glob.sync(path.resolve(__dirname, "_*.js"));

    const dealTypes = paths.reduce(
      /**
       * @param {Object<string, DealType>|Array<DealType & {id: string}>} dealsById
       */
      (dealsById, fullPath) => {
        const data = require(fullPath);
        const [fileName] = fullPath.split("/").slice(-1);
        const dealType = fileName.replace(/^_|\..+$/g, "");

        if (asArray) {
          dealsById.push({
            ...data,
            id: dealType,
          });
        } else {
          dealsById[dealType] = data;
        }

        return dealsById;
      },
      asArray ? [] : {}
    );

    return dealTypes;
  }

  /**
   * Finds a dealType by matching the ID with the pattern provided
   * @param {RegExp} idPattern The RegExp pattern to match the ID against
   */
  static match(idPattern) {
    const paths = glob.sync(path.resolve(__dirname, "_*.js"));
    const matchedFile = paths.find((fullPath) => idPattern.test(fullPath));

    if (matchedFile) {
      /**
       * @type {(DealType & {id: string})
       */
      const data = require(matchedFile);
      const [fileName] = matchedFile.split("/").slice(-1);
      const dealType = fileName.replace(/^_|\..+$/g, "");

      data.id = dealType;
      return data;
    }

    return {};
  }
}

module.exports = DealTypesConfig;
