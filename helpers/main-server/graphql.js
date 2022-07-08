const axios = require("axios").default;

const ENV = require("dotenv").config().parsed || {};
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
  });
};

module.exports = { query };
