const axios = require("axios").default;

const ENV = process.env || {};
const ENDPOINT = [
  (ENV.MAIN_SERVER_URL || "https://www.ifindilu.de").replace(/\/+$/, ""),
  "/graphql",
].join("");

const query = async (query = "", variables = {}) => {
  const headers = {
    "content-type": "application/json",
  };

  return axios({
    url: ENDPOINT,
    method: "post",
    headers: headers,
    data: { query, variables },
  }).catch((err) => {
    console.info(`Error in the following query:`.red.bold);
    console.info(query);
    console.info(variables);
    console.info(`ENDPOINT: ${ENDPOINT}`);
    throw err.message;
  });
};

module.exports = { query };
