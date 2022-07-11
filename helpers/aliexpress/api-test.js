require('colors');
const { getDetailsFromURL } = require('./api');
const productURL = process.argv.slice(2)[0];

console.log(`Product URL to test: ${productURL}`.cyan);

(async () => {

    if ( productURL ) {
        const data = await getDetailsFromURL(productURL);
        console.log(data);
    }
    else {
        console.log('No product ID provided'.yellow);
    }

})();