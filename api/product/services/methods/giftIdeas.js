module.exports = async (args) => {
  const queryParams = {
    website_tab: "gifts",
    _sort: "final_rating:desc",
  };

  if (args && args.tags && args.tags.length) {
    queryParams.tags_in = args.tags;
  }

  const taggedProducts = await strapi.services.product.find(queryParams);
  const total = taggedProducts.length;
  const start = args && args.page ? (Number(args.page) - 1) * 20 : 0;
  const products = taggedProducts.slice(start, start + 20);

  return {
    products,
    total,
  };
};
