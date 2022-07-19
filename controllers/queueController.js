const Queue = require("../scheduled-tasks/lib/Queue");

class QueueController {
  // queue listing
  static async index(req, res) {
      res.json(await Queue.getItems());
  }

  // add queue item
  static async add(req, res) {
    res.json(await Queue.add(req.body.task));
  }

  // start queue item
  static async start(req, res) {
    res.json(await Queue.startItem(req.body.item));
  }

  // stop queue item
  static async stop(req, res) {
    res.json(await Queue.stopItem(req.body.item));
  }
}

module.exports = QueueController;
