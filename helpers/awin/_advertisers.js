/**
 * @typedef {object} AdvertiserData
 * @property {number} id
 * @property {string} name
 *
 * @typedef {keyof typeof advertisers} AdvertiserHandles
 */

const advertisers = {
  notebooksbilliger: {
    id: 11348,
    name: "notebooksbilliger DE/AT",
  },
};

module.exports = {
  /**@param {RegExp} [pattern] */
  match: async (pattern) => {
    if (pattern instanceof RegExp) {
      return advertisers.find(({ name }) => pattern.test(name));
    }

    return null;
  },

  /**
   * @param {AdvertiserHandles} _handle
   * @return {AdvertiserData}
   */
  get(_handle) {
    return advertisers[_handle];
  },
};
