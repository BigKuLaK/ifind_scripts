/**
 * Batch-updates multiple categories
 * @param {[CategoryInput]} categoriesInput
 * @returns {[Category]}
 */
module.exports = async (categoriesInput) => {
  const updateDataList = categoriesInput.map(({ where, data }) => ({
    id: where.id,
    ...data,
  }));

  updatedCategories = [];

  // Update each category
  // Bookshelf guide: https://bookshelfjs.org/api.html#Model-instance-save
  for (let { id, ...newData } of updateDataList) {
    console.log(`Saving category: [${id}]`);
    const updatedCategory = await strapi.services.category.update(
      { id },
      newData
    );
    console.log("DONE");
    updatedCategories.push(updatedCategory);
  }

  return updatedCategories;
};
