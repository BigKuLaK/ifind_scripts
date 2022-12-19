/**
 * @typedef {import('./_advertisers').AdvertiserHandles} AdvertiserHandles
 */

const { default: fetch } = require("node-fetch");
const { get } = require("./_advertisers");

const USER_ID = 1713666;
const PUBLISHER_ID = 1026162;
const BEARER_TOKEN = "df8a36e4-1431-47cd-bb8b-1febfa3fd646";
const BASE_URL = "https://api.awin.com";

/**
 * @typedef {object} RequestParameters
 * @property {'publisher'|'advertiser'} [type]
 *
 * @typedef {object} LinkBuilderPayloadParameters
 * @property {string} [campaign]
 *
 * @typedef {object} LinkBuilderBatchRequest
 * @property {number} [advertiserId]
 * @property {string} [destinationUrl]
 *
 * @typedef {object} RequestPayload
 * @property {LinkBuilderBatchRequest[]} [requests]
 * @property {number} [advertiserId]
 * @property {string} [destinationUrl]
 * @property {boolean} [shorten]
 * @property {LinkBuilderPayloadParameters} [parameters]
 *
 * @typedef {object} LinkBuilderBatchResult
 * @property {number} status
 * @property {string} url
 * @property {string} destinationUrl
 */

class AWIN_API {
  static #ENDPOINT_LINK_BUILDER = `/publishers/${PUBLISHER_ID}/linkbuilder/generate`;
  static #ENDPOINT_LINK_BUILDER_BATCH = `/publishers/${PUBLISHER_ID}/linkbuilder/generate-batch`;

  /**
   * @param {string} url
   * @param {'get'|'post'} method
   * @param {RequestParameters} params
   * @param {RequestPayload} payload
   */
  static async #request(url, method, params = {}, payload = {}) {
    const searchParams = new URLSearchParams(params).toString();
    const fullUrl = url + (searchParams.length ? `?${searchParams}` : "");
    const fetchParams = {
      method,
    };

    fetchParams.headers = {
      Authorization: this.#generateAuthHeader(),
    };

    if (method === "post") {
      fetchParams.headers["content-type"] = "application/json";

      if (payload instanceof Object) {
        fetchParams.body = JSON.stringify(payload);
      }
    }

    return fetch(fullUrl, fetchParams)
      .then((response) => response.json())
      .catch((err) => console.error(err));
  }

  static #generateAuthHeader() {
    return `Bearer ${BEARER_TOKEN}`;
  }

  /**
   * @param {string} destinationUrl
   * @param {AdvertiserHandles} advertiserHandle
   */
  static async generateLink(destinationUrl, advertiserHandle) {
    const matchedAdvertiser = get(advertiserHandle);

    if (!matchedAdvertiser) {
      return null;
    }

    const url = BASE_URL + this.#ENDPOINT_LINK_BUILDER;
    const data = {
      advertiserId: matchedAdvertiser.id,
      destinationUrl,
      shorten: true,
    };

    return this.#request(url, "post", {}, data)
      .then((data) => {
        console.log(data);
        return data;
      })
      .then(({ shortUrl }) => shortUrl)
      .catch((err) => console.error(err));
  }

  /**
   * @param {string[]} destinationUrls
   * @param {AdvertiserHandles} advertiserHandle
   * @return {Promise<LinkBuilderBatchResult[]>}
   */
  static async generateLinks(destinationUrls, advertiserHandle) {
    const matchedAdvertiser = get(advertiserHandle);

    if (!matchedAdvertiser) {
      return [];
    }

    const requests = destinationUrls.map((destinationUrl) => ({
      advertiserId: matchedAdvertiser.id,
      destinationUrl,
    }));

    const url = BASE_URL + this.#ENDPOINT_LINK_BUILDER_BATCH;
    const data = { requests };

    return this.#request(url, "post", {}, data)
      .then(({ responses }) =>
        responses.map(({ status, body }) => ({
          status,
          url: body.url,
          destinationUrl: body.request.destinationUrl,
        }))
      )
      .catch((err) => console.error(err));
  }
}

module.exports = AWIN_API;
