const path = require('path');
const { existsSync, outputFileSync, readFileSync } = require('fs-extra');
const Logger = require('./Logger');

const databaseFilePath = path.resolve(__dirname, '../.db.json');
const configFilePath = path.resolve(__dirname, '../config');

const CONFIG = require(configFilePath);

class Database {
  static logger = new Logger({ context: 'scheduled-tasks-runner', outputOnly: true });

  static getAll( model ) {
    this.verifyDatabaseFile();

    if ( !this.modelExists(model) ) {
      return [];
    }
    const modelData = CONFIG.models[model];
    const modelTable = modelData.table;
    const modelFields = modelData.fields.map(({ name }) => name);
    const dbContents = this.getState();

    if ( !(modelTable in dbContents) ) {
      return [];
    }
    const dbEntries = dbContents[modelTable].map(dbData => {
      return modelFields.reduce(( collectedData, key ) => {
        collectedData[key] = dbData[key] || null;
        return collectedData;
      }, {});
    });

    // Check for config entries
    if ( !(modelTable in CONFIG) ) {
      return dbEntries;
    }

    const configEntries = CONFIG[modelTable];

    return configEntries.map(configEntry => {
      const matchedEntryFromDB = dbEntries.find(({ id }) => id == configEntry.id);

      // If entry is already present in db, use it
      if ( matchedEntryFromDB ) {
        return matchedEntryFromDB;
      }

      // Else, create it
      const newEntry = this.create(model, configEntry);
      return newEntry;
    });

  }

  static create(model, dataFragment = {}) {
    if ( !this.modelExists(model) ) {
      return null;
    }

    const modelData = CONFIG.models[model];
    const modelTable = modelData.table;
    const modelFields = modelData.fields.map(({ name }) => name);
    const dbContents = this.getState();

    if ( !(modelTable in dbContents) ) {
      dbContents[modelTable] = [];
    }

    const savedData = modelFields.reduce(( builtData, key) => {
      builtData[key] = dataFragment[key] || null;
      return builtData;
    }, {});

    dbContents[modelTable].push(savedData);
    this.saveState(dbContents);

    return savedData;
  }


  static update( model, entryID, dataFragment = {} ) {
    if ( !this.modelExists(model) ) {
      return null;
    }

    const modelData = CONFIG.models[model];
    const modelTable = modelData.table;
    const modelFields = modelData.fields.map(({ name }) => name);
    const dbContents = this.getState();

    let updatedModel = null;

    if ( !(modelTable in dbContents) ) {
      console.warn(`No entries yet from ${model}'s table`);
      return null;
    }

    dbContents[modelTable].some(dbEntry => {
      if ( dbEntry.id == entryID ) {
        Object.entries(dataFragment)
        .forEach(([ key, value ]) => {
          // Ensure data saved is only what's defined in the model
          if ( modelFields.includes(key) ) {
            dbEntry[key] = value;
          }
        });

        updatedModel = dbEntry;
        return true;
      }
    });
    this.saveState(dbContents);

    return updatedModel;
  }

  static get(model, dataMatch) {
    if ( !this.modelExists(model) ) {
      return null;
    }

    const modelData = CONFIG.models[model];
    const modelTable = modelData.table;
    const dbContents = this.getState();

    if ( !(modelTable in dbContents) ) {
      console.warn(`No entries yet from ${model}'s table`);
      return null;
    }

    const matchedEntry = dbContents[modelTable].find(entry => Object.entries(dataMatch).every(([ key, value ]) => (
      entry[key] == value
    )));

    return matchedEntry || null;
  }

  static getState() {
    this.verifyDatabaseFile();
    const dbContents = readFileSync(databaseFilePath).toString();
    return JSON.parse(dbContents || '{}');
  }

  static saveState(databaseState) {
    this.verifyDatabaseFile();
    const json = JSON.stringify(databaseState);
    outputFileSync(databaseFilePath, json);
  }

  static modelExists( model ) {
    if ( !(model in CONFIG.models) ) {
      const error = new Error(`Model ${model} does not exist.`);
      this.logger.log( error.message + error.stack, 'ERROR');
      return false;
    }

    return true;
  }

  static verifyDatabaseFile() {
    // Ensure databaseFile is present
    if ( !existsSync(databaseFilePath) ) {
      outputFileSync(databaseFilePath, JSON.stringify({
        tasks: [],
      }));
    }
  }
};

module.exports = Database;
