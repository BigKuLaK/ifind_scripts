const { query } = require("./graphql");

/**
 * @param {string} sourceName
 * @param {string} regionCode
 */
const getSourceRegion = async (sourceName, regionCode) => {
  return query(`{
    amazonSource: sources(where:{ name_contains: "${sourceName}" }) {
      id
    }
    germanRegion: regions(where:{ code: "${regionCode}" }) {
      id
    }
  }`)
};

module.exports = {
  getSourceRegion,
};
