require("colors");
const path = require("path");
const fs = require("fs-extra");
const moment = require("moment");
const { JSDOM } = require("jsdom");

const browser = require("../browser");
const { addURLParams } = require("../url");
// const proxiedRequest = require('./proxied-request');
// const regularRequest = require("./regular-request");
const screenshotPageError = require('./screenshotPageError');

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const PRICE_SELECTOR = [
  "#dealsAccordionRow .a-color-price",
  "#apex_offerDisplay_desktop .a-text-price .a-offscreen",
  "#corePrice_desktop .a-price",
  "#corePrice_feature_div .a-text-price",
  "#price_inside_buybox",
  "#priceblock_dealprice",
  "#priceblock_ourprice",
  '[data-action="show-all-offers-display"] .a-color-price',
  "#usedOnlyBuybox .offer-price",
  "#olp_feature_div .a-color-price",
].join(",");
const ORIGINAL_PRICE_SELECTOR =
  '#corePrice_desktop .a-text-price[data-a-color="secondary"] > :first-child';
const DISCOUNT_SELECTOR = "#corePrice_feature_div";
const QUANTITY_AVAILABLE_PERCENT_SELECTOR = '[id^="dealStatusPercentage_"]';
const QUANTITY_AVAILABLE_DESCRIPTOR_SELECTOR = "#availability";

const imageSelector = "#landingImage[data-a-dynamic-image]";
const titleSelector = "#title";
const additionalInfoTableSelector = "#productDetails_detailBullets_sections1";
const detailsListSelector = "#detailBullets_feature_div";

const detailSelector = "#centerCol";
const selectorsToRemove = [
  "#title",
  "#mars-pav-widget",
  "#desktop_unifiedPrice",
  "#unifiedPrice_feature_div",
  "#averageCustomerReviews_feature_div",
  "#ask_feature_div",
  '#variation_configuration [role="radiogroup"]',
  '#variation_style_name [role="radiogroup"]',
  '#variation_color_name [role="radiogroup"]',
  "#productSupportAndReturnPolicy_feature_div",
  "#poToggleButton",
  "#alternativeOfferEligibilityMessaging_feature_div",
  "#valuePick_feature_div",
  "#olp_feature_div",
  "#seeMoreDetailsLink",
  "#HLCXComparisonJumplink_feature_div",
  ".caretnext",
  "#productAlert_feature_div",
  "#atfCenter16_feature_div",
  "style",
  "script",
];

const requestHtml = async (url, waitForSelector = "body") => {
  await browser.goto(url);
  await browser.waitForSelector(waitForSelector);
  return await browser.$eval("body", (el) => el.innerHTML);
};

/*
  Scrapes for an amazon product's details:
  title, details_html, image
*/
const scrapeProductDetails = async (productURL, language = "en") => {
  const urlWithLanguage = addURLParams(productURL, { language });
  const scrapedDetails = {};

  try {
    console.log(" - Fetching all details for product...".cyan);
    const responseBody = await requestHtml(urlWithLanguage, detailSelector);
    const detailPageHTML = responseBody;

    const dom = new JSDOM(detailPageHTML);
    const titleElement = dom.window.document.querySelector(titleSelector);
    const imageElement = dom.window.document.querySelector(imageSelector);
    const detailElement = dom.window.document.querySelector(detailSelector);

    // Select highres image from dynamic image data
    const imageData = (scrapedDetails.image = imageElement
      ? JSON.parse(imageElement.dataset.aDynamicImage) || {}
      : {});
    const highResImage = Object.entries(imageData).reduce(
      (selectedEntry, [url, dimensions]) =>
        !selectedEntry
          ? [url, dimensions]
          : dimensions[0] > selectedEntry[1][0]
          ? [url, dimensions]
          : selectedEntry,
      null
    );

    // Remove unnecessary elements from detail section
    const allSelectorsToRemove = selectorsToRemove.join(",");
    [...detailElement.querySelectorAll(allSelectorsToRemove)].forEach(
      (element) => {
        try {
          element.remove();
        } catch (err) {
          /**/
        }
      }
    );

    // Apply scraped details
    scrapedDetails.title = titleElement
      ? titleElement.textContent.trim().replace(/\n/, "")
      : "";
    scrapedDetails.image = highResImage ? highResImage[0] : "";

    // Apply details_html
    scrapedDetails.details_html = detailElement.outerHTML
      .trim()
      .replace(/\n+/g, "\n");
  } catch (err) {
    console.error(err.message.red, urlWithLanguage.bold);
    await screenshotPageError(urlWithLanguage);
  }

  return scrapedDetails;
};

/*
  Scrapes for an amazon product's sale details:
  price, discount_percent, price_original, quantity_available_percent, and release_date
*/
const scrapeSaleDetails = async (productURL) => {
  // Use english page in order to parse price without having to account for other currencies
  const englishPageURL = addURLParams(productURL, { language: "en" });

  console.log(" - Fetching price for product...".cyan);
  let priceMatch,
    originalPriceMatch,
    discountPercentMatch,
    quantityAvailablePercentMatch,
    releaseDate;

  let tries = 3;
  while (tries) {
    try {
      await browser.goto(englishPageURL);

      await browser.waitForSelector(PRICE_SELECTOR, { timeout: 10000 });
      [
        priceMatch,
        originalPriceMatch,
        discountPercentMatch,
        quantityAvailablePercentMatch,
      ] = await browser.$eval(
        PRICE_SELECTOR,
        (
          priceElement,
          ORIGINAL_PRICE_SELECTOR,
          DISCOUNT_SELECTOR,
          QUANTITY_AVAILABLE_PERCENT_SELECTOR,
          QUANTITY_AVAILABLE_DESCRIPTOR_SELECTOR
        ) => {
          const priceMatch = priceElement.textContent.match(/[0-9.,]+/);
          const originalPriceElement = document.querySelector(
            ORIGINAL_PRICE_SELECTOR
          );
          const discountPercentElement =
            document.querySelector(DISCOUNT_SELECTOR);
          const quantityAvailablePercentElement = document.querySelector(
            QUANTITY_AVAILABLE_PERCENT_SELECTOR
          );
          const quantityAvailableDescriptorElement = document.querySelector(
            QUANTITY_AVAILABLE_DESCRIPTOR_SELECTOR
          );

          // Parse availability percent
          let availabilityContent;
          let availabilityPercentMatch = null;
          if (quantityAvailablePercentElement) {
            availabilityPercentMatch =
              quantityAvailablePercentElement.textContent.match(/[0-9.,]+/);
          } else if (quantityAvailableDescriptorElement) {
            availabilityContent =
              quantityAvailableDescriptorElement.textContent.trim();

            if (availabilityContent) {
              // Matches "In Stock"
              if (/^in stock/i.test(availabilityContent)) {
                availabilityPercentMatch = ["0"];
              }
              // Matches "Only {NUMBER} left in stock."
              else if (/\d+\s+in stock/i.test(availabilityContent)) {
                availabilityPercentMatch = availabilityContent.match(/\d+/i);
              } else {
                availabilityPercentMatch = null;
              }
            } else {
              availabilityPercentMatch = null;
            }
          }

          return [
            priceMatch,
            originalPriceElement
              ? originalPriceElement.textContent.match(/[0-9.,]+/)
              : null,
            discountPercentElement
              ? discountPercentElement.textContent.match(/[0-9]+(?=\s*%)/)
              : null,
            availabilityPercentMatch,
            availabilityContent,
          ];
        },
        ORIGINAL_PRICE_SELECTOR,
        DISCOUNT_SELECTOR,
        QUANTITY_AVAILABLE_PERCENT_SELECTOR,
        QUANTITY_AVAILABLE_DESCRIPTOR_SELECTOR
      );

      break;
    } catch (err) {
      console.error(err);
      console.log(
        `Unable to fetch price for URL: ${englishPageURL}. Retrying...`.red
      );
      await screenshotPageError(englishPageURL);
      tries--;
    }
  }

  // Product must be unavailable if there's no price parsed
  if (!priceMatch) {
    // Output file
    await screenshotPageError(englishPageURL);
    throw new Error(
      "Unable to parse price for the product from Amazon. Please make sure that it's currently available: " +
        englishPageURL.bold.gray,
      englishPageURL.bold.gray
    );
  }

  // Get the release date
  const parsedReleaseDates = await Promise.all([
    // Some products have additional info table,
    browser.evaluate((additionalInfoTableSelector) => {
      const additionalInfoTable = document.querySelector(
        additionalInfoTableSelector
      );
      if (!additionalInfoTable) return;
      const releaseDateRow = Array.from(additionalInfoTable.rows).find(
        (row) =>
          row.cells[0] && /date first available/i.test(row.cells[0].textContent)
      );
      return releaseDateRow && releaseDateRow.cells[1]
        ? releaseDateRow.cells[1].textContent.trim()
        : "";
    }, additionalInfoTableSelector),
    // Some products have details list
    browser.evaluate((detailsListSelector) => {
      const detailsListContainer = document.querySelector(detailsListSelector);
      if (!detailsListContainer) return;
      const releaseDateItemText = [
        ...detailsListContainer.querySelectorAll(".a-list-item"),
      ]
        .map((listItem) => listItem.textContent)
        .find((textContent) => /date first available/i.test(textContent));
      const dateMatch = releaseDateItemText
        ? releaseDateItemText.match(/[0-9]+[^0-9]+[0-9]{4}/i)
        : null;
      return dateMatch ? dateMatch[0] : null;
    }, detailsListSelector),
  ]);

  const releaseDateString = parsedReleaseDates.find((date) => date);

  if (releaseDateString) {
    const [day, monthAbbrev, year] = releaseDateString.split(" ");
    const isoDate = [year, MONTHS.indexOf(monthAbbrev.substr(0, 3)), day];

    const releaseDateMoment = moment.utc(isoDate);
    releaseDate = releaseDateMoment
      ? releaseDateMoment.toISOString().replace(/\.\d+Z$/, "")
      : "";
  }

  // Apply prices and discount data
  return {
    price: Number((priceMatch && priceMatch[0].replace(",", "")) || 0),
    discount_percent: Number(
      (discountPercentMatch && discountPercentMatch[0]) || null
    ),
    price_original: Number(
      (originalPriceMatch && originalPriceMatch[0]) || null
    ),
    quantity_available_percent: quantityAvailablePercentMatch
      ? 100 - Number(quantityAvailablePercentMatch[0])
      : null,
    release_date: releaseDate,
  };
};

const scrapeAmazonProduct = async (
  productURL,
  language = "de",
  scrapePriceOnly = false
) => {
  const scrapedData = {};

  // Scrape for all amazon details if applicable
  if (!scrapePriceOnly) {
    const scrapedDetails = await scrapeProductDetails(productURL, language);

    // Apply scraped details
    Object.entries(scrapedDetails).forEach(([key, value]) => {
      scrapedData[key] = value;
    });
  }

  // Scrape sale details:
  // price, price_original, discount_percent, quantity_available_percent, and release_date
  const scrapedSaleDetails = await scrapeSaleDetails(productURL);

  // Apply scraped sale details
  Object.entries(scrapedSaleDetails).forEach(([key, value]) => {
    scrapedData[key] = value;
  });

  return scrapedData;
};

module.exports = scrapeAmazonProduct;
