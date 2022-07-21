const offersCategories = require("../offers-categories");
const offersCategoriesOrder = require("../config/offers-categories-order");

module.exports = {
  query: `
      offersCategories: [OffersCategory]
    `,
  resolveQuery: {
    async offersCategories() {
      return offersCategoriesOrder.map((offerCategoryID) => ({
        id: offerCategoryID,
        ...offersCategories[offerCategoryID],
      }));
    },
  },
};
