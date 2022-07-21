const dealTypes = appRequire("api/ifind/deal-types");
const offersCategories = appRequire("api/ifind/offers-categories");

const PRODUCTS_PER_PAGE = 999999;

module.exports = async ({ deal_type = "", start = 0, offer_category = "" }) => {
  const sources = await strapi.services.source.find();
  const scheduledTasks = await strapi.scheduledTasks.list();

  const defaultOffersCategory = Object.keys(offersCategories).find(
    (categoryKey) => offersCategories[categoryKey].isDefault
  );
  const offerCategory = offer_category
    ? offersCategories[offer_category]
    : offersCategories[defaultOffersCategory];
  const selectedDealTypes = offerCategory
    ? offerCategory.dealTypes.reduce((dealTypesMap, dealTypeKey) => {
        dealTypesMap[dealTypeKey] = dealTypes[dealTypeKey];
        return dealTypesMap;
      }, {})
    : null;

  console.log({ offerCategory });

  if (!selectedDealTypes) {
    return null;
  }

  const productsByDeals = await Promise.all(
    Object.entries(selectedDealTypes)
      .filter(([dealTypeKey]) => (deal_type ? dealTypeKey === deal_type : true))
      .map(async ([dealTypeKey, { site, label, nav_label, nav_icon }]) => {
        const [products, total_products] = await Promise.all([
          strapi.services.product.find({
            deal_type: dealTypeKey,
            _limit: PRODUCTS_PER_PAGE,
            _start: start,
            _sort:
              "deal_quantity_available_percent:ASC,quantity_available_percent:ASC",
          }),
          strapi.services.product.count({
            deal_type: dealTypeKey,
          }),
        ]);

        const source = sources.find(({ name }) =>
          new RegExp(site, "i").test(name)
        );

        // Get last run data from scheduled task
        const matchedScheduledTask = scheduledTasks.find(
          ({ meta }) => meta && meta.deal_type === dealTypeKey
        );

        const last_run = matchedScheduledTask
          ? matchedScheduledTask.last_run
          : null;

        return {
          deal_type: {
            name: dealTypeKey,
            label,
            source,
            last_run,
            nav_label,
            nav_icon,
          },
          products,
          total_products,
        };
      })
  );

  return productsByDeals;
};
