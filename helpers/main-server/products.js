const { query } = require("./graphql");

const addDealsProducts = async (dealType, selectedProducts) => {
  console.log(
    `Adding ${selectedProducts.length} products for deal type ${dealType} [${process.env.MAIN_SERVER_URL}]`
  );

  await new Promise((res) => setTimeout(res, 1000));

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
    products: selectedProducts,
  };

  return query(gql, variables)
    .then(({ addProductsByDeals }) => addProductsByDeals)
    .catch((err) => {
      throw err;
    });
};

module.exports = {
  addDealsProducts,
};
