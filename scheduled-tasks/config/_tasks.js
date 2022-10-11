const frequencies = require("./_frequencies");

module.exports = [
  // {
  //   id: "product-validator",
  //   name: "Product Validator",
  //   schedule: frequencies.daily,
  // },
  // {
  //   id: "product-price-updater",
  //   name: "Product Price Updater",
  //   schedule: frequencies.daily,
  // },
  {
    id: "amazon-lightning-offers",
    name: "Amazon Lightning Offers",
    schedule: frequencies.hourly,
    timeout_minutes: 180,
    isReady: false,
    priority: 1,
    meta: {
      deal_type: "amazon_flash_offers",
      deal_merchant: "amazon",
    },
  },
  {
    id: "ebay-wow-offers",
    name: "Ebay Wow Offers",
    schedule: frequencies.hourly,
    timeout_minutes: 180,
    isReady: false,
    priority:2,
    meta: {
      deal_type: "ebay_wow_offers",
      deal_merchant: "ebay",
    },
  },
  {
    id: "aliexpress-value-deals",
    name: "AliExpress Super Value Deals",
    schedule: frequencies.hourly,
    timeout_minutes: 180,
    isReady: false,
    priority:3,
    meta: {
      deal_type: "aliexpress_value_deals",
      deal_merchant: "aliexpress",
    },
  },
  // {
  //   id: "mydealz-highlights",
  //   name: "MyDealz Highlights",
  //   schedule: frequencies.hourly,
  //   timeout_minutes: 180,
  //   isReady: false,
  //   priority:4,
  //   meta: {
  //     deal_type: "mydealz_highlights",
  //   },
  // },
];
