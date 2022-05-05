const path = require("path");
const fs = require("fs-extra");
const pageErrorsDir = path.resolve(__dirname, "page-errors");

module.exports = () =>
  fs.rmdirSync(pageErrorsDir, { force: true, recursive: true });
