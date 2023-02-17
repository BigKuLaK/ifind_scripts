/**
 * @typedef {import('axios').Method} Method
 * @typedef {import('axios').AxiosRequestConfig} AxiosRequestConfig
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
 * @param {AxiosRequestConfig} otherAxiosParams
 * @return {Promise<import('axios').AxiosResponse>}
 */
const query = (query = "", variables = {}, otherAxiosParams = {}) => {
  const headers = {
    "content-type": "application/json",
  };

  const requestParams = {
    method: /**@type {Method}*/ ("post"),
    headers: headers,
    data: { query, variables },
    ...otherAxiosParams,
  };

  return performAxiosRequest(ENDPOINT, requestParams, 10)
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

/**
 * @param {string} url
 * @param {AxiosRequestConfig} axiosParams
 * @return {Promise<import('axios').AxiosResponse>}
 */
const performAxiosRequest = async (
  url,
  axiosParams,
  serverErrorRetries = 0
) => {
  try {
    return await axios(url, axiosParams);
  } catch (error) {
    // Empty reponse must be a server error, allow retry if provided
    if (!error.response && serverErrorRetries >= 1) {
      console.info(
        `Admin server error. Retrying graphql request after 10 seconds...`
      );
      await new Promise((res) => setTimeout(res, 10000));
      return performAxiosRequest(url, axiosParams, serverErrorRetries - 1);
    } else {
      throw error;
    }
  }
};

module.exports = { query };
