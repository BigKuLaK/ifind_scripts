// Reference: https://github.com/Level/level

const path = require("path");
const { Level } = require("level");

// Create a database
const db = new Level(path.resolve(__dirname, "../.database"), { valueEncoding: "json" });

console.log('resolved path', path.resolve(__dirname, "../.database"));

class LevelDatabase {
  static sublevels = [];

  constructor(sublevelName) {
    if (!sublevelName) {
      throw new Error("Please provide a sublevel name!");
    }

    this.db = db;
    this.sublevel = db.sublevel(sublevelName, { valueEncoding: "json" });
    this.sublevel.name = sublevelName;

    LevelDatabase.sublevels.push(this.sublevel);
  }

  async put(key, data) {
    await this.sublevel.put(key, data);
  }

  static getDb() {
    return db;
  }
}

module.exports = LevelDatabase;
