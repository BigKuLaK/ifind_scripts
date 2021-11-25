class Hook {

  // Contains the actual hook process
  static async start(taskID) {
    // Do whatever
  }

  // Always call this from the child class
  static init() {
    // Handles parent process message in form of serializeable JSON data
    process.on('message', message => {
      const { command, data } = JSON.parse(message);
      this.onParentCommand(command, data);
    });

    this.sendProcess({ event: 'init' });
  }

  // Sends a JSON message to the parent process
  // @param serializeableData
  static sendProcess(serializeableData) {
    if ( typeof serializeableData !== 'object' ) {
      throw new Error('Unable to send a non-serializeable data');
    }
    else {
      process.send(JSON.stringify(serializeableData));
    }
  }

  static async onParentCommand(command, data) {
    switch (command) {
      case 'start':
        await this.start(data);
        process.exit();
    }
  }
}

module.exports = Hook;
