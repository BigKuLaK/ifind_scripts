require("colors");
const screenshotPageError = require("./screenshotPageError");

const GERMAN_ZIP_CODE = 74074;
const ZIP_CODE_VALUE_SELECTOR = "#GLUXZipConfirmationValue";
const ZIP_CHANGE_POPOVER_BUTTON = "#nav-global-location-popover-link";
const ZIP_INPUT_SECTION = "#GLUXZipInputSection";
const ZIP_INPUT_INPUT = `#GLUXZipUpdateInput`;
const ZIP_INPUT_APPLY = `#GLUXZipUpdate input[type="submit"]`;
const ADDRESS_CHANGE_URL =
  "https://www.amazon.de/gp/delivery/ajax/address-change.html";


const germanyLatLong = [51.1657, 10.4515];

module.exports = async (page) => {
  console.log(`Applying German location...`.cyan);

  try {
    // Check if page is already using german location
    const usesGermanLocation = await page.evaluate(
      (ZIP_CODE_VALUE_SELECTOR, GERMAN_ZIP_CODE) => {
        const zipCodeValueElement = document.querySelector(
          ZIP_CODE_VALUE_SELECTOR
        );

        return zipCodeValueElement
          ? zipCodeValueElement.textContent == GERMAN_ZIP_CODE
          : false;
      },
      ZIP_CODE_VALUE_SELECTOR,
      GERMAN_ZIP_CODE
    );

    if (usesGermanLocation) {
      return;
    }

    try {
      await page.waitForSelector(ZIP_CHANGE_POPOVER_BUTTON);

      console.log("Applying German zip code...");

      // Click to show popover
      await page.click(ZIP_CHANGE_POPOVER_BUTTON);

      await page.waitForSelector(ZIP_INPUT_SECTION);

      // Apply zip update
      await page.$eval(
        ZIP_INPUT_INPUT,
        (el, zipCode) => (el.value = zipCode),
        GERMAN_ZIP_CODE
      );
    } catch (err) {
      console.error(err.message.red);
      screenshotPageError(await page.url());
      return;
    }

    let zipApplied = false;
    let tries = 3;

    while (!zipApplied && --tries) {
      try {
        await Promise.all([
          page.click(ZIP_INPUT_APPLY),
          // Wait for address change response
          page.waitForResponse(ADDRESS_CHANGE_URL, { timeout: 10000 }),
        ]);
        zipApplied = true;
      } catch (err) {
        console.log(err.message.red);
        console.log(`Unable to apply zip change. Retrying...`.bold);
      }
    }

    if ( !zipApplied ) {
      console.error('Unable to apply zip code');
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));

    console.log("Reloading page to apply new address");
    await page.reload();
    return page;
  } catch (err) {
    await screenshotPageError(await page.url());
    throw err;
  }
};
