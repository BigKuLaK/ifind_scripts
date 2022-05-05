const path = require('path');
const fs = require('fs-extra');
const browser = require('../browser');

const screenshotPageError = async (url, pageInstance) => {
  const page = pageInstance && typeof pageInstance.screenshot === 'function' ? pageInstance : await browser.getPageInstance();
  const pageHTML = await page.evaluate(
    () => document.documentElement.innerHTML
  );
  const [urlPath] = decodeURIComponent(url).split("?");
  const directoryTree = urlPath.replace(/^.+amazon[^/]+\//i, "").split("/");
  const dirPath = path.resolve(__dirname, "page-errors", ...directoryTree);
  fs.ensureDirSync(dirPath);
  await page.screenshot({ path: path.resolve(dirPath, "index.png") });
  fs.outputFileSync(path.resolve(dirPath, "index.html"), pageHTML);
};

module.exports = screenshotPageError;
