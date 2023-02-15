const { query } = require("./graphql");

const addDealsProducts = async (dealType, products) => {
  console.log(`Adding ${products.length} products for deal type ${dealType}.`);
  console.log(`Endpoint host: ${process.env.MAIN_SERVER_URL}.`);

  const gql = `
      mutation AddNewDealsProducts ($deal_type:String!, $products: [ProductInput]) {
        addProductsByDeals( deal_type: $deal_type, products:$products ){
          id
          title
          updated_at
        }
      }
    `;

  const variables = {
    deal_type: dealType,
    products,
  };

  return query(gql, variables)
    .then(({ addProductsByDeals }) => addProductsByDeals)
    .catch((err) => console.error(err.message));
};

module.exports = {
  addDealsProducts,
};
