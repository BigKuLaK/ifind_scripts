const fetch = require("node-fetch");
const { appId, marketPlace } = require("./config");
const { toSearchParams } = require("../url");
const token = require("./token");

const getDetailsFromURL = async (productURL) => {
  const BASE_URL = "https://open.api.ebay.com/shopping";
  const params = {
    responseencoding: "JSON",
    siteid: 0,
    version: 967,
    appId: appId,
    callname: "GetSingleItem",
    IncludeSelector: "Details",
  };

  const itemID = extractIDFromURL(productURL);

  if (itemID) {
    const accessToken = await token.getToken("shopping");
    const requestParams = {
      ...params,
      ItemID: itemID,
    };
    const headers = {
      "X-EBAY-API-IAF-TOKEN": accessToken,
    };
    const res = await fetch(BASE_URL + toSearchParams(requestParams), {
      headers,
    });
    const data = await res.json();
    const { Item, Errors } = data;

    if (Errors) {
      console.error(Errors[0]);
    }

    if (Item) {
      const data = {};

      if (Item && Item.CurrentPrice && Item.CurrentPrice.Value) {
        data.title = Item.Title;
        data.price = Number(Item.CurrentPrice.Value);
        data.quantity_total = Number(Item.Quantity);
        data.quantity_sold = Number(Item.QuantitySold);
        data.image = (Item.PictureURL && Item.PictureURL[0]) || null;
      }

      return data;
    } else {
      return null;
    }
  }

  return null;
};

const getMultipleFromIDs = async (itemIDs = []) => {
  const BASE_URL = "https://open.api.ebay.com/shopping";
  const accessToken = await token.getToken("shopping");
  const params = {
    callname: "GetMultipleItems",
    responseencoding: "JSON",
    appid: appId,
    siteid: 0,
    version: 967,
    IncludeSelector: "Details",
  };
  const headers = {
    "X-EBAY-API-IAF-TOKEN": accessToken,
  };

  // Return as object map by itemID for easier access
  const itemsMap = {};

  // Chunk items by groups of 20, since we can only fetch 20 items at a time from eBay API
  const chunkedItems = itemIDs.reduce((grouped, item, index) => {
    grouped[index % 20] = grouped[index % 20] || [];
    grouped[index % 20].push(item);
    return grouped;
  }, []);

  // Fetch per chunk
  for (let items of chunkedItems) {
    const fetchParams = {
      ...params,
      // Append itemIDs param
      ItemID: items.join(","),
    };

    const res = await fetch(BASE_URL + toSearchParams(fetchParams), {
      headers,
    });
    const { Item, Errors } = await res.json();
    
    if (Errors) {
      console.error(Errors[0]);
    }

    if (Item) {
      // Ensure exact order as with the itemIDs parameter
      itemIDs.forEach((itemID) => {
        const matchedProductData = Item.find(({ ItemID }) => ItemID === itemID);

        if (matchedProductData) {
          const itemData = {
            itemID: matchedProductData.ItemID,
            price: Number(matchedProductData.CurrentPrice.Value),
            quantity_total: Number(matchedProductData.Quantity),
            quantity_sold: Number(matchedProductData.QuantitySold),
            image:
              (matchedProductData.PictureURL &&
                matchedProductData.PictureURL[0]) ||
              null,
          };

          itemsMap[itemData.itemID] = itemData;
        }
      });
    }
  }
  return itemsMap;
};

const getWowOffers = async (limit = 100, offset = 0) => {
  const accessToken = await token.getToken("deals");
  const BASE_URL = "https://api.ebay.com/buy/deal/v1/deal_item";
  const params = { limit, offset };
  const headers = {
    "X-EBAY-C-MARKETPLACE-ID": marketPlace.germany,
    Authorization: `Bearer ${accessToken}`,
  };

  // Process with request
  const res = await fetch(BASE_URL + toSearchParams(params), {
    headers,
  });
  const { errors, dealItems } = await res.json();

  if (errors && errors.length) {
    console.log(errors);
    return [];
  }

  const filtered = dealItems.filter((dealItem) => "marketingPrice" in dealItem);

  return filtered.map((dealItem) => ({
    itemID: dealItem.legacyItemId,
    title: dealItem.title,
    url: dealItem.itemWebUrl,
    image: (dealItem.image && dealItem.image.imageUrl) || null,
    price: Number(dealItem.price.value),
    price_original: Number(dealItem.marketingPrice.originalPrice.value),
    discount_percent: Number(dealItem.marketingPrice.discountPercentage),
  }));
};

const extractIDFromURL = (productURL) => {
  // Extract ebay itemID
  const [itemID] = productURL.match(/[0-9]{9,12}/g) || [];

  return itemID;
};

module.exports = {
  getDetailsFromURL,
  getMultipleFromIDs,
  getWowOffers,
  extractIDFromURL,
};
