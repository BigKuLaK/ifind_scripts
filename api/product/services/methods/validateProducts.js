const { isAmazonLink, scrapeAmazonProduct } = appRequire('helpers/amazon');
const { getDetailsFromURL: getDetailsFromEbayURL } = appRequire('helpers/ebay');
const { getDetailsFromURL: getDetailsFromAliExppressURL } = appRequire('helpers/aliexpress');

module.exports = async (forced = false) => {
  const queryParams = {
    _limit: 9999,
    status: 'published',
  };

  // Include all products if forced is true
  if ( forced ) {
    delete queryParams.status;
  }

  const sources = await strapi.services.source.find();
  const foundProducts = await strapi.services.product.find(queryParams);
  const productsWithIssues = [];

  // Sources
  const ebaySource = sources.find(({ name }) => /ebay/i.test(name));
  const aliexpressSource = sources.find(({ name }) => /ali/i.test(name));

  console.log(`Running validator on ${foundProducts.length} product(s)...`.cyan);

  for ( let i = 0; i < foundProducts.length; i++ ) {
    const product = foundProducts[i];
    const productIssues = [];

    console.log(`[ ${i + 1} of ${foundProducts.length} ]`.bold.cyan + ` Validating - [${String(product.id).bold}] ${product.title}`);

    // Validate amazon link
    if ( !isAmazonLink(product.amazon_url) ) {
      productIssues.push('amazon_link_invalid');
    } else {
      try {
        const scrapedDetails = await scrapeAmazonProduct(product.amazon_url, 'en', true);

        if ( !scrapedDetails ) {
          productIssues.push('amazon_link_unavailable');
        }
      } catch ( err ) {
        productIssues.push('amazon_link_unavailable');
      }
    }

    // Validate other URLs
    if ( product.url_list && product.url_list.length ) {
      for ( const urlData of product.url_list ) {
        switch ( urlData.source.id ) {

          // Validate Ebay
          case ebaySource.id:
            if ( !(await getDetailsFromEbayURL(urlData.url)) ) {
              productIssues.push('ebay_link_invalid');
            }
            break;

          // Validate AliExpress
          case aliexpressSource.id:
            if ( !(await getDetailsFromAliExppressURL(urlData.url)) ) {
              productIssues.push('aliexpress_link_invalid');
            }
            break;
        }
      }
    }

    if ( productIssues.length ) {
      product.product_issues = {};

      productIssues.forEach(product_issue => {
        product.product_issues[product_issue] = true;
      });

      // Save product as draft
      product.status = 'draft';
      await strapi.services.product.updateProduct(
        product.id,
        { status: 'draft', product_issues: product.product_issues },
        { price: false, amazonDetails: false },
        { change_type: 'product_validator_results' }
      )

      console.log(`Issue(s) were found for [`.yellow + String(product.id).yellow.bold + `] ${product.title}`.yellow);
      productsWithIssues.push(product.id);
    }
  }

  return productsWithIssues;
};
