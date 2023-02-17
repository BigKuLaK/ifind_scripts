/**
 * @typedef {object} ResponseErrorData
 * @property {string} message
 * @property {string} stack
 */

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
const query = (query = "", variables = {}, otherAxiosParams = {}) => {
  const headers = {
    "content-type": "application/json",
  };

  return axios({
    url: ENDPOINT,
    method: "post",
    headers: headers,
    data: { query, variables },
    ...otherAxiosParams,
  })
    .then((axiosResponse) => {
      switch (axiosResponse.config.responseType) {
        case "stream":
          return axiosResponse;
        default:
          const { data, errors } = axiosResponse.data;

          if (errors && errors.length) {
            throw {
              message: errors[0].message,
              stack: errors[0].extensions.exception.stacktrace.join("\n"),
            };
          }

          return data;
      }
    })
    .catch(
      /**@param {ResponseErrorData} error */
      (error) => {
        console.info(`----------------------------`.red);
        console.info(`Error in the following query:`.red.bold);
        console.info(query);
        console.info(`ENDPOINT: ${ENDPOINT}`);
        console.info(error.stack);
        console.info(`----------------------------`.red);
        throw error;
      }
    );
};

module.exports = { query };
