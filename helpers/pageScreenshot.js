/**
 * TODO:
 * Use this utility in place of the other screenshot operations.
 */

const { Page } = require("puppeteer/lib/cjs/puppeteer/common/Page");
const fetch = require("node-fetch");
const fs = require("fs-extra");
const path = require("path");

const PROJECT_DIR = path.resolve(__dirname, "../");
const SCREESHOTS_DIR = path.resolve(PROJECT_DIR, "public/screenshots");

// Ensure directory is present
fs.ensureDirSync(SCREESHOTS_DIR);

/**
 * Saves a screenshot for a given puppeteer page
 */
const pageScreenshot = async (page, customFolderPath) => {
  const htmlFileName = "index.html";
  const infoFileName = "info.json";
  const imageFileName = "screenshot.jpg";
  const timestamp = Date.now();
  let html, folderPath, url, urlNoSearch;

  // Use puppeteer if page is provided
  if (page instanceof Page) {
    url = await page.url();
    urlNoSearch = url.replace(/\?/, "/--");
    folderPath = path.resolve(
      SCREESHOTS_DIR,
      customFolderPath ? customFolderPath : urlNoSearch.replace(/[:/]+/g, "/")
    );
    html = await page.evaluate(() => document.documentElement.outerHTML);

    fs.ensureDirSync(folderPath, { recursive: true });

    // Save screenshot image
    await page.screenshot({
      path: path.resolve(folderPath, imageFileName),
    });
  } else if (typeof page === "string") {
    const response = await fetch(page);
    url = page;
    urlNoSearch = url.replace(/\?/, "/--");
    folderPath = path.resolve(
      SCREESHOTS_DIR,
      customFolderPath ? customFolderPath : urlNoSearch.replace(/[:/]+/g, "/")
    );
    html = await response.text();
  }

  // Save html and info
  fs.outputFileSync(path.resolve(folderPath, htmlFileName), html);
  fs.outputFileSync(
    path.resolve(folderPath, infoFileName),
    JSON.stringify({
      url,
      timestamp,
    })
  );
};

module.exports = pageScreenshot;
