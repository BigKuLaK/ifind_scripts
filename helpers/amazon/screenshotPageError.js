require('colors');
const path = require('path');
const fs = require('fs-extra');
const dayjs = require('dayjs');
const browser = require('../browser');

const screenshotPageError = async (url, pageInstance) => {
  const today = dayjs().format('YYYY-MM-DD');
  const page = pageInstance && typeof pageInstance.screenshot === 'function' ? pageInstance : await browser.getPageInstance();
  const pageHTML = await page.evaluate(
    () => document.documentElement.innerHTML
  );
  const [urlPath] = decodeURIComponent(url).split("?");

  console.log(`Generating screenshot for: ${urlPath}...`.gray);

  const directoryTree = urlPath.replace(/^.+amazon[^/]+\//i, "").split("/");
  const dirPath = path.resolve(__dirname, "../../public/screenshots", today, "amazon-page-errors", ...directoryTree);
  fs.ensureDirSync(dirPath);
  await page.screenshot({ path: path.resolve(dirPath, "index.jpg") });
  fs.outputFileSync(path.resolve(dirPath, "index.html"), pageHTML);
};

module.exports = screenshotPageError;
