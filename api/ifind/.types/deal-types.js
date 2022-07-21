module.exports = `
  type DealTypeLabelTranslation {
    language: String!
    label: String
  }

  type DealTypeNavIcon {
    type: String!
    icon: String!
  }

  type DealType {
    name: String
    label: [DealTypeLabelTranslation]
    nav_label: [DealTypeLabelTranslation]
    nav_icon: DealTypeNavIcon
    source: Source
    last_run: String
  }

  type ProductsByDeal {
    deal_type: DealType
    products: [Product]
    total_products: Int
  }
`;
