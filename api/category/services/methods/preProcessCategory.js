/**
 * Pre-processes a category before save
 * @param {Category} rawCategory
 * @param {String} language
 * @returns {Category}
 */
module.exports = async (rawCategory, language = null) => {
  /**
  Process label

  Label logic:
    1. If there is/are label entries
      1.1. If language is given, get label with matching language
      1.2 Get english label
      1.3 Get first label
    2. Use empty label
   */
  rawCategory.label = rawCategory.label
    ? rawCategory.label.find(
        (label) =>
          language && label.language && label.language.code === language.code
      ) ||
      rawCategory.label.find(
        (label) => label.language && label.language.code === "en"
      ) ||
      rawCategory.label[0]
    : "";

  const processedCategory =
    await strapi.services.category.prepopulateProductAttributes(rawCategory);

  return processedCategory;
};
