const { sanitizeEntity } = require('strapi-utils');

module.exports = {
  query: `
    footerSettingsByLanguage (language: String): ComponentEntryFieldsFooterFields
  `,
  resolver: {
    Query: {
      async footerSettingsByLanguage(_, args, ...rest) {
        const footerSettings = await strapi.services['footer-settings'].findByLanguage(args.language);
        return footerSettings;
      }
    }
  }
};
