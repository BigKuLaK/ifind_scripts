require('colors');
const { getDetailsFromURL, cleanUp } = require('./api');
const productURL = process.argv.slice(2)[0];

console.log(`Product URL to test: ${productURL}`.cyan);

(async () => {

    if ( productURL ) {
        const data = await getDetailsFromURL(productURL);
        console.log(data);
        await cleanUp();
    }
    else {
        console.log('No product ID provided'.yellow);
    }

})();