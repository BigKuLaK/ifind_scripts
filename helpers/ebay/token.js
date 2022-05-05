const fetch = require('node-fetch');
const {
  clientId,
  clientSecret,
  redirectUri,
  api_scopes,
} = require('./config');
const EbayAuthToken = require('ebay-oauth-nodejs-client');

const ebayAuthToken = new EbayAuthToken({
  clientId,
  clientSecret,
  redirectUri,
});

const CURRENT_TOKEN = Symbol();
const CURRENT_TOKEN_EXPIRY = Symbol();

// @param apiName - Should match key from config.api_scopes
const getNewToken = async ( apiName ) => {
  const response = await ebayAuthToken.getApplicationToken('PRODUCTION', api_scopes[apiName]);
  return JSON.parse(response);
};

module.exports = {
  // Currently fetched token
  [CURRENT_TOKEN]: null,

  // Current token's datetime expiration
  [CURRENT_TOKEN_EXPIRY]: null,

  // Get new token
  async getToken(apiName = 'shopping') {
    const now = Date.now();

    if ( !this[CURRENT_TOKEN] || now <= this[CURRENT_TOKEN_EXPIRY] ) {
      await this._getNewToken(apiName);
    }

    return this[CURRENT_TOKEN];
  },

  async _getNewToken(apiName) {
    const now = Date.now();
    const { access_token, expires_in, error_description } = await getNewToken(apiName);

    if ( error_description ) {
      console.error(error_description);
    } else {
      this[CURRENT_TOKEN] = access_token;
    // Subtract 10s from actual expiration
    // Allows us to fetch just before the token expires
    this[CURRENT_TOKEN_EXPIRY] = now + ((expires_in - 10) * 1000);
    }
  }
}
