const axios = require("axios").default;

const ENV = process.env || {};
const BASE_URL = (ENV.MAIN_SERVER_URL || "https://www.ifindilu.de").replace(
  /\/+$/,
  ""
);

const get = async (path, otherAxiosParams) => {
  const headers = {};

  const URL = BASE_URL + path;

  return await axios({
    url: URL,
    method: "get",
    headers: headers,
    ...otherAxiosParams,
  }).catch((err) => {
    console.info(`Error in the following query:`.red.bold);
    console.info(`URL: ${URL}`);

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

module.exports = { get };
