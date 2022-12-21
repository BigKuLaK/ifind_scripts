const createTorProxy = require("../../../helpers/tor-proxy");

const MINDFACTORY_URL = "https://www.mindfactory.de/";
const MINDSTAR_URL = "https://www.mindfactory.de/Highlights/MindStar";
const SELECTORS = {
  mindStarLink: 'a[title="MindStar"]',
  productLink: ".hidden-xs.hidden-sm .ms_product .ms_prodimage a",
};
const PAGE_TIMEOUT = 30000;

(async () => {
  console.log("Mindstar special offers");

  const torProxy = await createTorProxy({
    referer: MINDFACTORY_URL,
    origin: MINDFACTORY_URL,
  });

  const page = await torProxy.newPage();

  // console.log("Going to page...");
  // await page.goto(MINDFACTORY_URL);

  // console.log("Waiting for selector...");
  // await page.waitForSelector(SELECTORS.mindStarLink);

  // console.log("Clicking selector...");
  // await page.$eval(
  //   SELECTORS.mindStarLink,
  //   /**@param {Partial<HTMLElement> & Element} element */
  //   (element) => {
  //     if (element.click) {
  //       element.click();
  //     }
  //   }
  // );

  // console.log("Waiting for page navigation");
  // await page.waitForNavigation({ timeout: PAGE_TIMEOUT });

  try {
    console.log("Going to page");
    await page.goto(MINDSTAR_URL);

    console.log("Waiting for selector");
    await page.waitForSelector(SELECTORS.productLink);

    const productLinks = await page.$$eval(SELECTORS.productLink, (elements) =>
      elements.map((element) => element.getAttribute("href"))
    );

    console.log(productLinks);
  } catch (err) {
    await torProxy.saveScreenShot();
  }
})();
