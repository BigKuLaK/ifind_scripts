const filterByLanguage = appRequire('helpers/filterByLanguage');

module.exports = {
  definition: `
    type PageData {
      slug: String!
      data: ComponentEntryFieldsPageFields
    }
  `,
  query: `
    pageBySlug(slug: String!, language: String): PageData
  `,
  resolver: {
    Query: {
      async pageBySlug(_, args) {
        const pageData = await strapi.services['page'].findBySlug(args.slug, args.language);

        return pageData
          ? {
            slug: pageData.slug,
            data: filterByLanguage(pageData.page_data, args.language),
          }
          : null;
      }
    }
  }
};
