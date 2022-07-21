/**
 * TODO: Abstract out custom Schema definitions for better structure
 */
const scheduledTasksTypes = require("../.types/scheduled-tasks");
const dealTypesTypes = require("../.types/deal-types");
const offersCategoriesTypes = require("../.types/offers-categories");

const scheduledTasksResolver = require("../.resolvers/scheduled-tasks");
const dealTypesResolver = require("../.resolvers/deal-types");
const offersCategoriesResolver = require("../.resolvers/offers-categories");

module.exports = {
  definition: `
    ${dealTypesTypes}
    ${scheduledTasksTypes}
    ${offersCategoriesTypes}
   `,
  query: `
    ${scheduledTasksResolver.query}
    ${dealTypesResolver.query}
    ${offersCategoriesResolver.query}
   `,
  mutation: `
    ${scheduledTasksResolver.mutation}
   `,
  type: {},
  resolver: {
    Query: {
      ...scheduledTasksResolver.resolveQuery,
      ...dealTypesResolver.resolveQuery,
      ...offersCategoriesResolver.resolveQuery,
    },
    Mutation: {
      ...scheduledTasksResolver.resolveMutation,
      // ...dealTypesResolver.resolveMutation,
    },
  },
};
