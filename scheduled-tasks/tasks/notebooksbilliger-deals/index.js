const fetch = require("node-fetch");
const cp = require("child_process");
const { JSDOM } = require("jsdom");
const pause = require("../../../helpers/pause");
const puppeteer = require("puppeteer");
const { addDealsProducts } = require("../../../helpers/main-server/products");

const NotebooksBilligerScraper = require("./scraper");

const DEALS_URL = `https://www.notebooksbilliger.de/angebote`;
const DEAL_ITEM_SELECTOR = "a.js-deal-item";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36";

const start = async () => {
  const deals = await NotebooksBilligerScraper.getDeals();
};

start();
