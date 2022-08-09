const EventEmitter = require("events");
const Database = require("./Database");
const { models } = require("../config");

const EVENT_EMITTER_KEY = Symbol();

class Model extends EventEmitter {
  constructor() {
    super();

    this.class = this.__proto__.constructor;
    this[EVENT_EMITTER_KEY] = new EventEmitter();
  }

  create(data) {
    const sanitizedData = this.sanitizeData(data);

    // Save to DB
    Database.create(this.class.model, sanitizedData);

    return sanitizedData;
  }

  update(data) {
    const sanitizedData = this.sanitizeData(data);

    Object.entries(sanitizedData).forEach(([key, value]) => {
      this[key] = value;
    });

    // Save to DB
    Database.update(this.class.model, this.id, sanitizedData);

    this[EVENT_EMITTER_KEY].emit('update');
  }

  get(dataMatch) {
    return Database.get(this.class.model, dataMatch);
  }

  /**
   * Sanites a given data to match Model's fields
   * @param {objet} data The data
   */
  sanitizeData(data) {
    // Filter data to ensure only model properties are present
    const sanitizedData = {};

    const modelData = models[this.class.model];

    // Ensure that this task the model defined
    if (!modelData) {
      return null;
    }

    const fields = modelData.fields || [];

    fields.forEach(({ name: fieldName }) => {
      if (fieldName in data) {
        sanitizedData[fieldName] = data[fieldName];
        this[fieldName] = data[fieldName];
      }
    });

    return sanitizedData;
  }

  on(event, handler) {
    this[EVENT_EMITTER_KEY].on(event, handler);
  }

  emit(event, data) {
    this[EVENT_EMITTER_KEY].emit(event, data);
  }
}

// Child class should define Model.model
// e.g., Task.model = 'task'

/**
 * Static methods
 */
Model.getAll = function () {
  return (
    // Get alll database entries
    Database.getAll(this.model)
      // Instantiate as Task instances
      .map((rawData) => new this(rawData))
  );
};

module.exports = Model;
