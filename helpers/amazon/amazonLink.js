const { affiliateParams } = require('./config');
const { toSearchParams, paramsToObject } = require('../url');

const amazonLink = (originalLink = '') => {
  const [ baseURL, searchParamsString = '' ] = (originalLink || '').split('?');
  const searchParamsObj = paramsToObject(searchParamsString);

  return baseURL + toSearchParams({
    ...searchParamsObj,
    ...affiliateParams,
  });
}

module.exports = amazonLink;
