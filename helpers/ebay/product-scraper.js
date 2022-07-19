const fetch = require("node-fetch");
const { JSDOM } = require("jsdom");
const { getDetailsFromURL } = require("./api");

const scrapeProduct = async (productURL, language = "de") => {
  const [apiData, pageData] = await Promise.all([
    getDetailsFromURL(productURL),
    extractPageData(productURL, language),
  ]);

  return {
    ...apiData,
    price_original: pageData.price_original,
    discount_percent:
      apiData.discount_percent || pageData.discount_percent || null,
  };
};

const extractPageData = async (productURL, language = "de") => {
  const document = await getProductPageDOM(productURL);

  if (document) {
    const titleElement = document.querySelector(".x-item-title__mainTitle");
    const priceElement = document.querySelector("#prcIsum");
    const originalPriceElement = document.querySelector(".vi-originalPrice");

    // Computed values
    const price = priceElement
      ? normalizePriceValue(priceElement.textContent.trim(), language)
      : null;
    const price_original = originalPriceElement
      ? normalizePriceValue(originalPriceElement.textContent.trim(), language)
      : null;
    const discount_percent = price_original
      ? Math.round(100 * (1 - price / price_original))
      : null;

    return {
      title: titleElement ? titleElement.textContent.trim() : null,
      price,
      price_original: price_original !== price ? price_original : null,
      discount_percent,
    };
  }

  return null;
};

const normalizePriceValue = (priceText, language = "de") => {
  const priceTextSanitized = priceText.replace(/[^0-9,.]+/gi, "");

  switch (language) {
    // Euros
    case "de":
      return Number(
        priceTextSanitized.replace(/[,.]/g, (match) =>
          match === "," ? "." : ","
        )
      );
    default:
      return priceTextSanitized;
  }
};

const getProductPageDOM = async (productURL) => {
  try {
    const response = await fetch(productURL);
    const body = await response.text();
    const {
      window: { document },
    } = new JSDOM(body);

    return document;
  } catch (err) {
    console.error(err);
    return null;
  }
};

module.exports = {
  scrapeProduct,
};