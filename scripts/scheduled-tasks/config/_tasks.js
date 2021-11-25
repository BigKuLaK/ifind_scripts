const frequencies = require("./_frequencies");

module.exports = [
  {
    id: "product-validator",
    name: "Product Validator",
    schedule: frequencies.daily,
  },
  {
    id: "product-price-updater",
    name: "Product Price Updater",
    schedule: frequencies.daily,
  },
  {
    id: "amazon-lightning-offers",
    name: "Amazon Lightning Offers",
    schedule: frequencies.hourly,
  },
  {
    id: "ebay-wow-offers",
    name: "Ebay Wow Offers",
    schedule: frequencies.hourly,
  },
  {
    id: "aliexpress-value-deals",
    name: "AliExpress Super Value Deals",
    schedule: frequencies.hourly,
  },
];
