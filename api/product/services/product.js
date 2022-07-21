"use strict";

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-services)
 * to customize this service
 */

const path = require('path');
const { readdirSync } = require('fs-extra');

const methodDir = path.resolve(__dirname, 'methods');
const methodDirContents = readdirSync(methodDir);

module.exports = methodDirContents.reduce((methods, methodFileName) => {
  const [ methodName ] = methodFileName.split('.');
  methods[methodName] = require(`./methods/${methodName}`);
  return methods;
}, {});
