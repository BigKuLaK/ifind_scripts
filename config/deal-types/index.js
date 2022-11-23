const glob = require('glob');
const path = require('path');

class DealTypesConfig {
    static getAll() {
        const paths = glob.sync(path.resolve(__dirname, '_*.js'));
        const dealTypes = paths.reduce((dealsById, fullPath) => {
            const data = require(fullPath);
            const [ fileName ] = fullPath.split('/').slice(-1);
            const dealType = fileName.replace(/^_|\..+$/g, '');

            dealsById[dealType] =  data;

            return dealsById;
        }, {});

        return dealTypes;
    }
}

module.exports = DealTypesConfig;