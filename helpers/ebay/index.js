const { getDetailsFromURL }  =require('./api');

module.exports = {
  config: require('./config'),
  api: require('./api'),
  ebayLink: require('./ebayLink'),
  getDetailsFromURL,
};
