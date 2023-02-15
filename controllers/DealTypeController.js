const DealTypes = require("../ifind-utilities/airtable/models/deal_types");

class DealTypeController {
  // TODO: Improve this logic, and move to scheduled tasks controller
  // tasks listing
  static async index(req, res) {
    const dealTypes = await DealTypes.allData();

    // Construct deal types mapping
    // Selecting only fields that we want to expose in the response
    const dealTypeMap = dealTypes.reduce(
      (
        mappedData,
        {
          id,
          nav_label,
          label,
          site_id,
          deal_category_id,
          tasks_ids,
          site_icon,
        }
      ) => {
        mappedData[id] = {
          id,
          nav_label,
          label,
          site: site_id[0],
          deal_category: deal_category_id ? deal_category_id[0] : null,
          tasks: tasks_ids,
        };

        if (site_icon) {
          mappedData[id].nav_icon = {
            type: "ifind",
            icon: site_icon[0],
          };
        }

        return mappedData;
      },
      {}
    );

    return res.status(200).json({
      success: true,
      data: dealTypeMap,
    });
  }
}

module.exports = DealTypeController;
