const { affiliateParams } = require('./config');
const { toSearchParams, paramsToObject } = require('../url');

const ebayLink = (originalLink = '') => {
  // Remove unnecessary params
  const [ baseURL, queryParams ] = originalLink.split('?');
  const queryParamsObj = paramsToObject(queryParams);

  return baseURL + toSearchParams({
    ...queryParamsObj,
    ...affiliateParams,
  });
}

module.exports = ebayLink;
