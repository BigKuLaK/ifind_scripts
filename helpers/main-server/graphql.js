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
    console.info(`Error in the following query:`.red);
    console.info(query);
    console.info(err.response.data.errors);
    throw err.message;
  });
};

module.exports = { query };
