const path = require('path');
const appRoot = path.resolve(__dirname, '../');

/**
 * Add necessary globals
 */

// Resolves given path to the root of the app
global.resolveApp = relativePath => path.resolve(appRoot, relativePath);

// Requires module from the root of the app
global.appRequire = (relativePath) => require(resolveApp(relativePath));
