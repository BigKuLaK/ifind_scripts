const DealCategories = require("../ifind-utilities/airtable/models/deal_categories");

class DealCategoryController {
  // TODO: Improve this logic, and move to scheduled tasks controller
  // tasks listing
  static async index(req, res) {
    const dealCategories = await DealCategories.allData();

    // Map deal categories by ID,
    // Selecting only necessary fields to expose in the response
    const dealCategoryMap = dealCategories.reduce(
      (mappedData, { id, label, deal_type_ids, is_default }) => {
        mappedData[id] = {
          id,
          label,
          dealTypes: deal_type_ids,
        };

        if (is_default) {
          mappedData[id].isDefault = true;
        }

        return mappedData;
      },
      {}
    );

    return res.status(200).json({
      success: true,
      data: dealCategoryMap,
    });
  }
}

module.exports = DealCategoryController;
