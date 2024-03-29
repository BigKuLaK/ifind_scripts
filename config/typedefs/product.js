/**
@typedef {object} ProductDealData
@property {string} url - String!
@property {boolean} [is_base] - Boolean
@property {number} price - Float
@property {number} [price_original] - Float
@property {number} [discount_percent] - Float
@property {number} [quantity_available_percent] - Float

*/

/**
@typedef {object} Product
@property {string} title - String
@property {number} [price] - Float
@property {string} image - String!
@property {Array<ProductDealData>} [url_list] - [ComponentAtomsUrlWithType]
@property {string} [details_html] - String
@property {string} [release_date] - DateTime
@property {number} [quantity_available_percent] - Float
@property {number} [discount_percent] - Float
@property {number} [price_original] - Float
@property {number} [deal_quantity_available_percent] - Float
@property {string} [deal_merchant] - String
@property {string} deal_type - String
@property {number} [deal_expiry] - Int
 */

module.exports = {};
