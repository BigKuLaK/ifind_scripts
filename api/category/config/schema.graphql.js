module.exports = {
  definition: `
    type CategoryWithChild {
      label: ComponentAtomsTranslateableLabel
      id: ID!
      order: Int!
      icon: String
      region: Region
      parent: Category
      children: [ CategoryWithChild ]
    }
  `,
  query: `
    categoryTree (language: String, root: ID): [CategoryWithChild]
  `,
  mutation: `
    updateCategories( categories: [updateCategoryInput] ): [Category]
    updateProductCounts: [Category]
  `,
  resolver: {
    Query: {
      async categoryTree(_, args) {
        const categoryTree = await strapi.services.category.categoryTree(
          args.language,
          args.root
        );
        return categoryTree;
      },
    },
    Mutation: {
      async updateCategories(_, args, ...rest) {
        const updatedCategories = await strapi.services.category.updateMultiple(
          args.categories
        );
        return updatedCategories;
      },
      async updateProductCounts() {
        const updatedCategories =
          await strapi.services.category.updateProductCounts();
        return updatedCategories;
      },
    },
  },
};
