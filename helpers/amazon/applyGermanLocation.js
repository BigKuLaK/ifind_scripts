require("colors");
const pause = require("../pause");
const screenshotPageError = require("./screenshotPageError");

const GERMAN_ZIP_CODE = "74074";
const ZIP_CHANGE_POPOVER_BUTTON = "#nav-global-location-popover-link";
const ZIP_INPUT_SECTION = "#GLUXZipInputSection";
const ZIP_INPUT_INPUT = `#GLUXZipUpdateInput`;
const ZIP_CONFIRMATION_VALUE = `#GLUXZipConfirmationValue`;
const ZIP_CHANGE_LINK = `#GLUXChangePostalCodeLink`;
const ZIP_INPUT_APPLY = `#GLUXZipUpdate input[type="submit"]`;
const ZIP_CONFIRM = `.a-popover-footer #GLUXConfirmClose`;
const ADDRESS_CHANGE_URL =
  "https://www.amazon.de/portal-migration/hz/glow/address-change";

module.exports = async (page) => {
  const pageURL = (await page.url()).replace(/\?.+$/, "");

  console.log(` - Applying German location...`.cyan);

  const hasPopoverButton = await page.evaluate(
    (ZIP_CHANGE_POPOVER_BUTTON) =>
      document.querySelector(ZIP_CHANGE_POPOVER_BUTTON) ? true : false,
    ZIP_CHANGE_POPOVER_BUTTON
  );

  if (!hasPopoverButton) {
    console.info(" - Waiting for popover button...".gray);
    await page.waitForSelector(ZIP_CHANGE_POPOVER_BUTTON);
  }

  // Click to show popover
  console.info(" - Opening up zip code form.");
  await page.click(ZIP_CHANGE_POPOVER_BUTTON);

  await new Promise((res) => setTimeout(res, 1500));
  await screenshotPageError(pageURL + "--zip-popover-visible", page);

  try {
    // Check if page is already using german location
    const currentZipCode = await page.evaluate((ZIP_CODE_VALUE_SELECTOR) => {
      const zipCodeValueElement = document.querySelector(
        ZIP_CODE_VALUE_SELECTOR
      );

      return zipCodeValueElement ? zipCodeValueElement.textContent.trim() : "";
    }, ZIP_CONFIRMATION_VALUE);

    if (currentZipCode === GERMAN_ZIP_CODE) {
      console.info(" - German ZIP code is already applied. Proceeding...".gray);
      return;
    }

    try {
      console.info(" - Changing current zip value.");
      await page.evaluate((ZIP_CHANGE_LINK) => {
        const changeLink = document.querySelector(ZIP_CHANGE_LINK);

        if (changeLink) {
          changeLink.click();
          return true;
        }

        return false;
      }, ZIP_CHANGE_LINK);

      console.info(" - Change zip clicked, waiting for input element.".gray);
      await page.waitForSelector(ZIP_INPUT_SECTION);

      // await screenshotPageError(pageURL + '--zip-input-visible', page);

      // Apply zip update
      console.info(" - Filling in new ZIP code.".gray);
      await page.$eval(
        ZIP_INPUT_INPUT,
        (el, zipCode) => (el.value = zipCode),
        GERMAN_ZIP_CODE
      );

      // await screenshotPageError(pageURL + '--zip-input-filled', page);
    } catch (err) {
      console.error(err.message.red);
      await screenshotPageError(await page.url(), page);
      return;
    }

    let zipApplied = false;
    let tries = 3;

    while (!zipApplied && --tries) {
      try {
        await pause(500);
        console.info(" - Applying new ZIP code.".gray);
        await page.click(ZIP_INPUT_APPLY);

        await pause(500);
        console.info(" - New zip code applied, confirming...".gray);
        await page.waitForSelector(ZIP_CONFIRM),

        await pause(500);
        console.info(" - Clicking confimation...".gray);
        await page.click(ZIP_CONFIRM);

        console.info(' - Confirmation clicked, waiting for address change response');
        await screenshotPageError(pageURL + '--zip-confirmed', page);

        zipApplied = true;
      } catch (err) {
        await screenshotPageError(pageURL + '--apply-zip-error', page);
        console.log(err.message.red);
        console.log(` - Unable to apply zip change. Retrying...`.bold);
      }
    }

    if (!zipApplied) {
      console.error(" - Unable to apply zip code");

      // Save screenshot for investigation
      await screenshotPageError(await page.url(), page);
      return page;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));

    console.info(" - Reloading page to apply new address".gray);
    await page.reload();
    return page;
  } catch (err) {
    await screenshotPageError(await page.url(), page);
    throw err;
  }
};
