module.exports = `
  type OffersCategoryLabelTranslation {
    language: String!
    label: String
  }

  type OffersCategory {
    id: ID!
    label: [OffersCategoryLabelTranslation]
    dealTypes: [ID]
    isDefault: Boolean
  }
`
