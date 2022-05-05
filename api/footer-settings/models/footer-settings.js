'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#lifecycle-hooks)
 * to customize this model
 */

const processFooterData = async (data) => {
  const languages = await strapi.services.language.find();

  Array.isArray(data.footer_data) && data.footer_data.forEach(footerData => {

    // Update label_preview
    if ( footerData.links ) {
      footerData.links.forEach(link => {
        link.label_preview = link.label.map(label => label.text).join(' | ');
      });
    }

    // Update language_preview for each footer_data entry
    if ( footerData.language ) {
      const matchedLanguage = languages.find(language => language.id === footerData.language);
      footerData.language_preview = matchedLanguage ? matchedLanguage.name : '';
    }
  });
}

module.exports = {
  lifecycles: {
    beforeCreate: async (data) => {
      await processFooterData(data);
    },
    beforeUpdate: async (params, data) => {
      await processFooterData(data);
    },
  }
};
