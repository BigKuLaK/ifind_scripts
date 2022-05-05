const getEbayWowOffers = require("../helpers/ebay/wow-offers");
const ebayLink = require("../helpers/ebay/ebayLink");
const EBAY_DEAL_TYPE = "ebay_wow_offers";
var mysql = require('mysql');
var cron = require('node-cron');


var con = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "ifind_admin"
});


const fetchEbayAPI = async () => {
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
    }
    catch (err) {
        console.log("Error", err)

    }
}
// cron.schedule('*/5 * * * *', fetchEbayAPI, {
//     scheduled: true,
//     timezone: 'Asia/Kolkata'
// })