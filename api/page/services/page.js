'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-services)
 * to customize this service
 */

module.exports = {
  async findBySlug( slug ) {
    return await strapi.query('page').findOne({ slug });
  }
};
