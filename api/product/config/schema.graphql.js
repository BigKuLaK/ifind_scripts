module.exports = {
  definition: `
    type ProductCategory {
      label: String
      id: ID!
      order: Int
      created_at: DateTime
    }
    input ProductsListWhereParamInput {
      search: String
      category: ID
      status: String
      website_tab: String
      deal_type: String
    }
    type ProductsListPayload {
      count: Int
      products: [Product]
    }
    type NaturalList {
      category: ProductCategory
      products: [Product]
    }
    type ProductClicksDetails {
      id: ID
      clicks_count: Int
    }
    type FixedProductsPayload {
      count: Int
      products: [Product]
    }
    type GiftIdeasPayload {
      products: [Product]
      total: Int
    }
  `,
  query: `
    productDetails (id: ID!, language: String): Product
    productComparisonList (language: String, root: ID): [NaturalList]
    categoryProducts (language: String, categories: [ID], includeDescendants: Boolean): [NaturalList]
    productsList (sort: String, limit: Int, start: Int, where: ProductsListWhereParamInput): ProductsListPayload
    giftIdeas ( page: Int, tags: [ID] ): GiftIdeasPayload
  `,
  mutation: `
    addProductClick (id: ID!): ProductClicksDetails
    fixProducts: FixedProductsPayload
    updateProductLinks: FixedProductsPayload
  `,
  resolver: {
    Query: {
      async productDetails(_, args) {
        return await strapi.services.product.getProductDetails(args.id, args.language);
      },
      async productComparisonList(_, args) {
        return await strapi.services.product.productComparisonList(args.language, args.root);
      },
      async productsList(_, args) {
        return await strapi.services.product.productsList(args);
      },
      async categoryProducts(_, args) {
        return await strapi.services.product.categoryProducts(args.language, args.categories, args.includeDescendants);
      },
      async giftIdeas(_, args) {
        return await strapi.services.product.giftIdeas(args);
      }
    },
    Mutation: {
      async addProductClick(_, args) {
        const updatedProductClicks = await strapi.services.product.addProductClick(args.id);
        return updatedProductClicks;
      },
      async fixProducts() {
        const updatedProducts = await strapi.services.product.fixProducts();
        return {
          count: updatedProducts.length,
          products: updatedProducts,
        }
      },
      async updateProductLinks() {
        const updatedProducts = await strapi.services.product.updateProductLinks();
        return {
          count: updatedProducts.length,
          products: updatedProducts,
        }
      }
    }
  }
};
