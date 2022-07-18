const { query } = require("./graphql");

/**
 * @param {string} sourceName
 * @param {string} regionCode
 */
const getSourceRegion = async (sourceName, regionCode) => {
  return query(`{
    source: sources(where:{ name_contains: "${sourceName}" }) {
      id
    }
    region: regions(where:{ code: "${regionCode}" }) {
      id
    }
  }`).then(({ data }) => ({
    source: data.data.source[0],
    region: data.data.region[0],
  }));
};

module.exports = {
  getSourceRegion,
};
