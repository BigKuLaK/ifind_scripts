const isAmazonLink = (link) => (
  /^https?/i.test(link) && /amazon/ig.test(link)
);

module.exports = isAmazonLink;
