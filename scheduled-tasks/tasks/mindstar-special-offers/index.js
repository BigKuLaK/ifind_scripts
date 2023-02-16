const { xml2js } = require("xml-js");
const fetch = require("node-fetch");
const DealsScraper = require("../../../helpers/deals-scraper");

/**
 * Typdefs
 *
 * @typedef {import('../../../helpers/deals-scraper').DealData} DealData
 * @typedef {import("../../../config/typedefs/product").Product} Product
 */

const MINDSTAR_XML_URL =
  "https://www.mindfactory.de/xml/rss/mindstar_artikel.xml";

class MindStarSpecialOffers extends DealsScraper {
  skipProductPageScraping = true;

  async hookGetInitialProductsData() {
    const initialProducsData = await this.getFeed();
    return initialProducsData;
  }

  async getFeed() {
    console.info(`Fetching RSS feed`);
    const response = await fetch(MINDSTAR_XML_URL);
    const xml = await response.text();
    const {
      elements: [
        {
          elements: [{ elements }],
        },
      ],
    } = xml2js(xml);

    const elementNameToProductProp = {
      title: "title",
      _msprice: "priceCurrent",
      _price: "priceOld",
      _image: "image",
      link: "url",
      description: "details_html",
    };

    const products = elements
      .filter(({ name }) => name === "item")
      .map(({ elements }) => {
        return elements.reduce((productData, element) => {
          if (element.name in elementNameToProductProp) {
            const propKey = elementNameToProductProp[element.name];
            const value = element.elements[0][element.elements[0].type];
            const valueFormatted = /price/i.test(element.name)
              ? Number(value.replace(/,/g, ""))
              : value.trim();

            productData[propKey] = valueFormatted;
          }
          return productData;
        }, {});
      });

    return products;
  }

  hookNormalizeProductsData(initialProducsData, dealType) {
    return initialProducsData.map(
      /**
       * @param {DealData & { details_html: string }} productData
       * @returns {Product}
       */
      (productData) => ({
        title: productData.title,
        deal_type: dealType.id,
        image: productData.image,
        details_html: productData.details_html,
        url_list: [
          {
            url: productData.url,
            price: productData.priceCurrent,
            price_original:
              productData.priceCurrent === productData.priceOld
                ? undefined
                : productData.priceOld,
            discount_percent:
              100 -
              (productData.priceCurrent /
                (productData.priceOld || productData.priceCurrent)) *
                100,
          },
        ],
      })
    );
  }
}

new MindStarSpecialOffers().start();
