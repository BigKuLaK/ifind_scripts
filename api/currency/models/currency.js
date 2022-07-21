'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#lifecycle-hooks)
 * to customize this model
 */

 const processCurrencyData = async data => {
  if ( data.name && data.symbol ) {
    data.label_preview = `${data.symbol} - ${data.name}`;
  }
}

module.exports = {
  lifecycles: {
    async beforeCreate(data) {
      await processCurrencyData(data);
    },
    async beforeUpdate(params, data) {
      await processCurrencyData(data);
    }
  }
};
