const { getTranslatedLabel } = appRequire("helpers/category");

const sortCategoryProducts = (categoryID, products) => {
  // Filter only published products
  // const filteredProducts = products.filter(
  //   ({ status }) => status === "published"
  // );

  // TODO: Revert back filtered products when amazon scraper issues are resolved
  const filteredProducts = products;

  // Sort by position, ascending
  filteredProducts.sort((prodA, prodB) =>
    prodA.position > prodB.position ? 1 : -1
  );

  // Get only first 5 products
  return filteredProducts.slice(0, 5).map((product) => ({
    ...product,
    category: categoryID,
  }));
};

/**
 * Retrieves a list of products for the given list of categories
 * For Product Comparison Page
 * Return format is in the form of array of NaturalList items
 * @param {String} language
 * @param root - List of category IDs
 */
module.exports = async (language = "en", root) => {
  const findCategoriesParams = {
    products_count_gt: 0,
    _sort: "order:ASC,id:DESC",
    _limit: 9999,
  };

  const ascendantsIDs = [];

  // Use first category from CategoryTree if none is provided
  if ( !root ) {
    const [firstCategory] = await strapi.services.category.find({
      _sort: "order:asc,id:desc",
      parent_null: true,
    });

    if ( firstCategory ) ascendantsIDs.push(firstCategory.id);
  }
  else {
    ascendantsIDs.push(Number(root));
  }

  // Get granchildren categories with products
  const descendants = await strapi.services.category.find({
    _limit: 9999,
    ascendants_in: ascendantsIDs,
    products_count_gt: 0,
    children_count: 0,
  });

  // Add category ids to params
  findCategoriesParams.id_in = descendants.map(({ id }) => id);

  // Get all categories data from the given list of category IDs,
  // Filtering only the ones with products
  const categoriesWithProducts = await strapi.services.category.find(findCategoriesParams);

  // Map through each category,
  // Build a NaturalList data for each category
  return await Promise.all(
    categoriesWithProducts.map(async (category) => {
      return {
        category: {
          ...category,
          label: await getTranslatedLabel(category.label),
        },
        products: sortCategoryProducts(category.id, category.products || []),
      };
    })
  );
};
