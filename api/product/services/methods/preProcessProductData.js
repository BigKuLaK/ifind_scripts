const moment = require("moment");
const { compareProductChanges } = appRequire("helpers/productChanges");
const { getProductDetails, extractProductDealData } =
  appRequire("helpers/product");
const { applyCustomFormula } = appRequire("helpers/productAttribute");
const { getState, setProductChangeParams } = appRequire("helpers/redux");

const updateScopeDefault = {
  price: true,
  amazonDetails: true,
};

/**
 * Preprocesses product data from request, before create/save
 * @param {Product} data - Raw Product data from request
 * @param {ID} id
 * @returns {Product}
 */
module.exports = async (data, id) => {
  const { productChange } = getState();
  const { productChangeParams } = productChange;

  // Save admin_user for afterSave hook
  setProductChangeParams({
    ...productChangeParams,
    admin_user: data.admin_user || productChangeParams.admin_user,
    change_type:
      data.admin_user && productChangeParams.change_type !== "create"
        ? "admin_update"
        : productChangeParams.change_type,
  });

  const matchedProduct = (await strapi.services.product.findOne({ id })) || {};

  // Set product update scope
  data.updateScope = {
    ...updateScopeDefault,
    ...data.updateScope,
  };

  // No need for additional scraped data if no price and details update needed
  // Use case: clicks_count update only
  if (!data.updateScope.price || !data.updateScope.amazonDetails) {
    return data;
  }

  const [productAttributes] = await Promise.all([
    strapi.services["product-attribute"].find(),
  ]);

  await Promise.all([
    // Add dynamic position if not yet given
    (async () => {
      if (!data.position) {
        const productsWithPositions = await strapi.services.product.find({
          position_gt: 0,
          id_ne: id,
          categories_contains:
            Array.isArray(data.categories) && data.categories.length
              ? data.categories[0]
              : null,
        });

        const takenPositions = productsWithPositions.map(
          (data) => data.position
        );
        let positionToTake = 1;

        // Determine available position
        while (takenPositions.includes(positionToTake)) {
          positionToTake++;
        }

        data.position = positionToTake;
      }
    })(),

    // Scrape other fields
    (async () => {
      // Using only image and title for checking
      // For some reason, details_html is not passed on update
      const scapePriceOnly = data.title && data.image && true;

      const productDetails = await getProductDetails(
        data,
        "de",
        scapePriceOnly
      );

      // Apply scraped data
      if (productDetails) {
        Object.entries(productDetails).forEach(([key, value]) => {
          data[key] = value;
        });
      }
    })(),
  ]);

  // If the product is a deal, compute for the additional deal-specific data
  if (!/none/i.test(data.deal_type)) {
    const dealData = extractProductDealData(data);

    if ( dealData ) {
      if (dealData.quantity_available_percent) {
        data.deal_quantity_available_percent = dealData.quantity_available_percent;
      }
    }

  }

  // Change product status to Draft if some issues arised from the scraper
  if (Object.values(data.product_issues || {}).some(Boolean)) {
    data.status = "draft";
  }
  // Else, set product as published
  else {
    data.status = "published";
  }

  // Recompute product attributes
  // Needs to come after the scraper in order to pickup the scraped data
  if (data.attrs_rating && data.attrs_rating.length) {
    data.attrs_rating = data.attrs_rating.map((attrRating) => {
      const matchedProductAttribute = productAttributes.find(
        ({ id }) => attrRating.product_attribute == id
      );

      if (matchedProductAttribute) {
        // Autofill release date if applicable
        if (
          /release/i.test(matchedProductAttribute.name) &&
          data.release_date
        ) {
          attrRating.use_custom_formula = true;
          attrRating.min = data.release_date;
          attrRating.max = moment.utc().subtract(3, "years").toISOString();
        }

        if (attrRating.use_custom_formula) {
          attrRating.rating = applyCustomFormula(
            attrRating,
            matchedProductAttribute,
            data
          );
        }
      }

      return attrRating;
    });
  }

  // Remove temporary data
  delete data.updateScope;

  // Extract only changed data
  const changedData = compareProductChanges(matchedProduct, data);

  // Save temporary data for afterSave use
  setProductChangeParams({ state: changedData });

  return data;
};
