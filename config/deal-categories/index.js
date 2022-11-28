const glob = require("glob");
const path = require("path");

class DealCategoriesConfig {
  static getAll() {
    const paths = glob.sync(path.resolve(__dirname, "_*.js"));
    const dealCategories = paths.reduce((dealsByCategory, fullPath) => {
      const data = require(fullPath);
      const [fileName] = fullPath.split("/").slice(-1);
      const dealCategory = fileName.replace(/^_|\..+$/g, "");

      dealsByCategory[dealCategory] = data;

      return dealsByCategory;
    }, {});

    return dealCategories;
  }
}

module.exports = DealCategoriesConfig;
