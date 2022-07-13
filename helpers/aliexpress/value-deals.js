const path = require("path");
const fs = require("fs-extra");
const createTorBrowser = require("../../helpers/tor-proxy");

const torBrowser = createTorBrowser();

const VALUE_DEALS_PAGE_URL =
  "https://de.aliexpress.com/campaign/wow/gcp/superdeal-g/index";
const PRODUCT_CARD_SELECTOR = "div[spm]:not([utabtest])";
const PRODUCTS_CARDS_COUNT = 10;
const COOKIES = [
  {
    name: "int_locale",
    value: "en_US",
    url: VALUE_DEALS_PAGE_URL,
    domain: ".aliexpress.com",
    path: "/",
  },
  {
    name: "aep_usuc_f",
    value: "region=DE&c_tp=EUR",
    url: VALUE_DEALS_PAGE_URL,
    domain: ".aliexpress.com",
    path: "/",
  },
];

const getValueDeals = async () => {
  return new Promise(async (resolve, reject) => {
    const page = await torBrowser.newPage();
    await page.setViewport({
      width: 1920,
      height: 5000,
    });

    // Just enough viewport width
    await page.setViewport({
      width: 1920,
      height: 1000,
    });

    // Set cookies so we can access AliExpress Deals Page
    console.info("Setting cookies".cyan);
    await page.setCookie(...COOKIES);

    // Go to value deals page
    console.info("Getting to deals page".cyan);
    await page.goto(VALUE_DEALS_PAGE_URL, { timeout: 99999999 });

    try {
      // Ensure we don't wait infinitely
      // Times out when page takes too long without reponse,
      // meaning there is no content being fetched
      const pageTimeout = setTimeout(async () => {
        const pagePath = (await page.url()).replace(/https?:(\/\/)?/g, "");
        const screenshotsRoot = path.resolve(
          __dirname,
          "page-errors",
          pagePath
        );

        fs.ensureDirSync(screenshotsRoot, { recursive: true });

        page.screenshot({
          path: path.resolve(screenshotsRoot, "screenshot.jpg"),
        });

        // Log
        console.log("Browser takes too long, page might not able to scrape elements.")
      }, 300000);

      // Await for required selector
      console.info("Waiting for required selector.".cyan);
      await page.waitForSelector(PRODUCT_CARD_SELECTOR, { timeout: 30000 });

      // Parse cards
      const cardsData = await page.evaluate(
        (PRODUCT_CARD_SELECTOR, PRODUCTS_CARDS_COUNT) => {
          return new Promise((resolve) => {
            const lastSection = document.querySelector(
              ".rax-scrollview-webcontainer"
            ).lastElementChild;

            const interval = setInterval(() => {
              const [...productCards] = document.querySelectorAll(
                PRODUCT_CARD_SELECTOR
              );
              if (productCards.length >= PRODUCTS_CARDS_COUNT) {
                clearInterval(interval);
                resolve(
                  productCards.map((card) => {
                    const [href] = card.getAttribute("href").split("?");
                    return `https:${href}`;
                  })
                );
              } else {
                lastSection.scrollIntoView({
                  behavior: "smooth",
                  block: "end",
                });
              }
            }, 2000);
          });
        },
        PRODUCT_CARD_SELECTOR,
        PRODUCTS_CARDS_COUNT
      );

      clearInterval(pageTimeout);

      resolve(cardsData);
    } catch (err) {
      console.error(err);
      reject(err);
    }
  }).catch((err) => {
    throw err;
  });
};

module.exports = {
  getValueDeals,
};
