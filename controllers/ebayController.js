const getEbayWowOffers = require("../helpers/ebay/wow-offers");
const ebayLink = require("../helpers/ebay/ebayLink");
const EBAY_DEAL_TYPE = "ebay_wow_offers";
var mysql = require('mysql');

var con = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "ifind_admin"
});

exports.ebayApi = async (req, res) => {
  try {
    console.log("Getting Ebay Wow Offers...");
    const offers = await getEbayWowOffers();
    console.log("started creating strapi instance");
    console.log("strapi instance creation successful");
    
    const ebaySource = "ebay"
    const germanRegion = "de"

    console.log("Saving new products...");
    let savedProducts = 0;


    // Add strapi-specific data

    con.connect(function (err) {
      if (err) throw err;
      console.log("Connected!");
      var sql = "INSERT INSERT INTO products SET ?";
      for (const offer of offers) {
        const newProduct = {
          website_tab: 'home',
          deal_type: EBAY_DEAL_TYPE,
          title: offer.title,
          image: offer.image,
          deal_quantity_available_percent: offer.quantity_available_percent,
          url_list: [
            {
              source: 4,
              region: 1,
              url: ebayLink(offer.url),
              price: offer.price,
              price_original: offer.price_original,
              discount_percent: offer.discount_percent,
              quantity_available_percent: offer.quantity_available_percent,
            },
          ],
        };
        con.query(sql, newProduct, function (err, result) {
          if (err) throw err;
          console.log("1 record inserted");
        });
      }
    });
    console.log(" DONE ".bgGreen.white.bold);
    process.exit();
  } catch (err) {
    console.error(err, err.data);
    process.exit();
  }
}

// Restful API for scrap ebay data

exports.fetchEbayAPI = async (req, res) => {
  try {
    const offers = await getEbayWowOffers();
    let savedProducts = 0;
    con.connect(function (err) {
      var sql = "DELETE FROM products WHERE deal_type= 'ebay_wow_offers'";
      con.query(sql, function (err, result) {
        if (err) throw err;
        console.log("1 record inserted");
      });
      console.log("Remove All Data of Ebay Products");
      var sql = "INSERT INTO products SET ?";
      for (const offer of offers) {

        const newProduct = {
          website_tab: "home",
          deal_type: EBAY_DEAL_TYPE,
          title: offer.title,
          image: offer.image,
          deal_quantity_available_percent: offer.quantity_available_percent,
          source: 4,
          region: 1,
          // url: ebayLink(offer.url),
          price: offer.price,
          price_original: offer.price_original,
          discount_percent: offer.discount_percent,
          quantity_available_percent: offer.quantity_available_percent,
          status: "published"
        };
        console.log("newProduct", newProduct);
        con.query(sql, newProduct, function (err, result) {
          if (err) throw err;
          console.log(
            `[ ${++savedProducts} of ${offers.length} ] Saved new product: ${newProduct.title
              }`.green
          );
          console.log(" DONE ".bgGreen.white.bold);
        });
      }
    });
  } catch (err) {
    console.error(err, err.msg);
    res.status(500).json(
      {
        success: false,
        msg: err.message
      }
    );
  }
}