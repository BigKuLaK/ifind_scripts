const createTorProxy = require("../tor-proxy");
const applyGermanLocation = require("./applyGermanLocation");
const screenshotPageError = require("./screenshotPageError");

const TOR_PROXY = createTorProxy();

const LIGHTNING_OFFERS_PAGE =
  "https://www.amazon.de/-/en/gp/angebote?ref_=nav_cs_gb_c869dbce88784497bfc3906e5456094e&deals-widget=%257B%2522version%2522%253A1%252C%2522viewIndex%2522%253A0%252C%2522presetId%2522%253A%2522deals-collection-lightning-deals%2522%252C%2522dealType%2522%253A%2522LIGHTNING_DEAL%2522%252C%2522sorting%2522%253A%2522BY_SCORE%2522%257D";

const PRODUCT_CARD = '[class^="DealCard-module__card"]';

const getLightningOffers = async () => {
  try {
    let page;

    let germanLocationTries = 0;

    while ( ++germanLocationTries <= 3 ) {
      try {
        page = await TOR_PROXY.newPage();
        await page.setDefaultNavigationTimeout(0);

        console.info(" - Getting to Lightning Offers Page...".cyan);

        await page.goto(LIGHTNING_OFFERS_PAGE, { timeout: 60000 });

        // Apply german location
        await applyGermanLocation(page);

        // Wait for the grid
        await page.waitForSelector(PRODUCT_CARD);

        // Get productLinks
        const productLinks = await page.$$eval(PRODUCT_CARD, (elements) =>
          [...elements]
            .slice(0, 50)
            .map((card) => {
              const cardLink = card.querySelector(".a-link-normal");
              return cardLink ? cardLink.href : null;
            })
            .filter((url) => url && /amazon\.[a-z]+\/[^\/]{10,}\//.test(url))
        );

        return { products: productLinks, page };
      }
      catch (err) {
        console.warn(err.message.red);
        await TOR_PROXY.saveScreenShot();
        console.warn('Unable to apply German location for the current page. Changing proxy...');
        await TOR_PROXY.launchNewBrowser();
      }
    }

  } catch (err) {
    console.error([err.message.red, err.stack].join(" "));
    await screenshotPageError(LIGHTNING_OFFERS_PAGE, page);
    return { products: [] };
  }

  return { products: [] };
};

module.exports = getLightningOffers;
