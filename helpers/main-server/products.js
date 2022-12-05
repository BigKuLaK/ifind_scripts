const { query } = require("./graphql");
const DealTypesConfig = require("../../config/deal-types");

const addDealsProducts = async (dealType, products) => {
  console.log(`Adding products for deal type ${dealType}.`);
  console.log(`Endpoint host: ${process.env.MAIN_SERVER_URL}.`);
  console.log("Sample product data:");
  console.log(products[0]);

  const gql = `
      mutation AddNewDealsProducts ($deal_type:String!, $products: [ProductInput]) {
        addProductsByDeals( deal_type: $deal_type, products:$products ){
          id
          title
        }
      }
    `;

  const variables = {
    deal_type: dealType,
    products,
  };

  return query(gql, variables).catch((err) => console.error(err));
};

module.exports = {
  addDealsProducts,
};
