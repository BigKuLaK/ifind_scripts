'use strict';

const filterByLanguage = appRequire('helpers/filterByLanguage');

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-services)
 * to customize this service
 */

module.exports = {
  async findByLanguage(language) {
    const footerSettings = await this.find();

    return footerSettings
    ? filterByLanguage(footerSettings.footer_data, language)
    : null;
  }
};
