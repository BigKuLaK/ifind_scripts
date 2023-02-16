const moment = require("moment");
const Tasks = require("../../ifind-utilities/airtable/models/tasks");

const saveLastRunFromProducts = async (taskRecordID, products) => {
  if (!taskRecordID) {
    console.warn(
      `Unable to update task record. The record ID for task ${process.env.task} is missing.`
    );
    return;
  }

  if (!products.length) {
    console.warn(`Unable to get last_updated from empty products.`);
    return;
  }

  const productCreatedDates = products.map((product) =>
    moment.utc(product.updated_at).valueOf()
  );
  const last_run = Math.max(...productCreatedDates);

  console.info(
    `[DEALSCRAPER] Updating task data for ${process.env.task} at record ${taskRecordID}`
  );

  await Tasks.update([
    {
      id: taskRecordID,
      fields: {
        last_run,
      },
    },
  ]);
};

module.exports = {
  saveLastRunFromProducts,
};
