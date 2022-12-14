const axios = require("axios").default;

const ENV = process.env || {};
const ENDPOINT = [
  (ENV.MAIN_SERVER_URL || "https://www.ifindilu.de").replace(/\/+$/, ""),
  "/graphql",
].join("");

/**
 * @param {import('axios').AxiosRequestConfig} otherAxiosParams
 * @return {Promise<import('axios').AxiosResponse>}
 */
const query = async (query = "", variables = {}, otherAxiosParams = {}) => {
  const headers = {
    "content-type": "application/json",
  };

  return axios({
    url: ENDPOINT,
    method: "post",
    headers: headers,
    data: { query, variables },
    ...otherAxiosParams,
  }).catch((err) => {
    console.info(`Error in the following query:`.red.bold);
    console.info(query);
    console.info(`ENDPOINT: ${ENDPOINT}`);

    const error = err.toJSON();

    console.log({ otherAxiosParams });

    // if (err.response) {
    //   console.error(err.response.data.errors[0]);
    // } else if (err.request) {
    //   console.error(err.request.errors[0]);
    // }

    throw error;
  });
};

module.exports = { query };
