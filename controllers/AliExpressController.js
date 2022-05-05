const { getValueDeals } = require("../helpers/aliexpress/value-deals");
const { getDetailsFromURL } = require("../helpers/aliexpress/api");
var mysql = require('mysql');

var con = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "ifind_admin"
});

const RETRY_WAIT = 30000;

// Restful API for scrap Ali Express Data

exports.aliExpressApi = async (req, res) => {s
  try {
    console.log("Inside aliExpressApi");
   
  
    let valueDealsLinks = [];

    await new Promise(async (resolve) => {
      while (!valueDealsLinks.length) {
        try {
          console.log("Fetching from Super Value Deals Page...".cyan);
          valueDealsLinks = await getValueDeals();
        } catch (err) {
          console.error(err);
          console.error(
            `Unable to fetch deals page. Retrying in ${Number(
              RETRY_WAIT / 1000
            )} second(s)...`.red
          );
          await new Promise((resolve) => setTimeout(resolve, RETRY_WAIT));
        }
      }
      resolve();
    });

    const productsData = [];

    while (!productsData.length) {
      console.log(
        `Getting product details for ${valueDealsLinks.length} product link(s) scraped...`
          .cyan
      );

      for (let productLink of valueDealsLinks) {
        console.log(`Fetching data for: ${productLink}`.gray);

        try {
          const productData = await getDetailsFromURL(productLink);
          productsData.push(productData);

          console.log(
            `[ ${productsData.length} ] Details fetched for ${productData.title.bold}`
              .green
          );
        } catch (err) {
          console.error(`Error while fetching ${productLink}: ${err.message}`);
        }
      }

      console.log(`Total of ${productsData.length} products has been fetched.`);

      if (!productsData.length) {
        console.log(
          `No products fetched. Retrying in ${Number(
            RETRY_WAIT / 1000
          )} second(s)...`.magenta
        );
        await new Promise((resolve) => setTimeout(resolve, RETRY_WAIT));
      }
    }
    // Remove old products

    con.connect(function (err) {
      console.log("Removing old products...".green);
      var sql = "DELETE FROM products WHERE deal_type= 'aliexpress_value_deals'";
      let numrows = 0;
      con.query(sql, function (err, result) {
        if (err) throw err;
        numrows = result.affectedRows;
        console.log("Aliexpress Records deleted");
      });
      // Save new products
      console.log("Saving new products...".green);

      let saved = 0;

      for (const productData of productsData) {
        const newData = {
          website_tab: "home",
          deal_type: "aliexpress_value_deals",
          title: productData.title,
          image: productData.image,
          source: 4,
          region: 1,
          price: productData.price,
          price_original: productData.price_original,
          discount_percent: productData.discount_percent,
        };
        // Add query for MySql
        var sql = "INSERT INTO products SET ?"
        con.query(sql, newData, function (err, result) {
          if (err) throw err;
          console.log("1 record inserted");
        });
        console.log(
          `[ ${++saved} of ${productsData.length} ] Successfully saved: ${newData.title.bold
            }`.green
        );
        console.log(" DONE ".bgGreen.white.bold);
      }
    })
    
    process.exit();
  } catch (err) {
    console.error(err, err.data);
    throw err;
  }
};
