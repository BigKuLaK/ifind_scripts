const path = require('path');
const fs = require('fs-extra');
const fetch = require("node-fetch");
const { JSDOM } = require('jsdom');
const Browser = require('../browser');

// Allow each request to use a random user agent
// To avoid getting blocked by Amazon
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/47.0.2526.111 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_2) AppleWebKit/601.3.9 (KHTML, like Gecko) Version/9.0.2 Safari/601.3.9",
  "Mozilla/5.0 (X11; CrOS x86_64 8172.45.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.64 Safari/537.36",
  "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:15.0) Gecko/20100101 Firefox/15.0.1",
];

module.exports = async (url) => {
  await Browser.goTo(url);
  const body = await Browser.getHtml();

  if (body) {
    return body;
  }

  // All user agents have been used up but no response was received
  throw new Error(`Unable to parse data for the product URL: ${url}`);
};
