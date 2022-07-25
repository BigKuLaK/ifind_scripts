const Queue = require("../scheduled-tasks/lib/Queue");

class QueueController {
  // queue listing
  static async index(req, res) {
    res.json(await Queue.getItems());
  }

  // add queue item
  static async add(req, res) {
    try {
      const { status, ...response } = await Queue.add(req.body.task);
      res.status(status).json(response);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  }

  // start queue item
  static async start(req, res) {
    try {
      const { status, ...response } = await Queue.startItem(req.body.item)
      res.status(status).json(response);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  }

  // stop queue item
  static async stop(req, res) {
    res.json(await Queue.stopItem(req.body.item));
  }
}

module.exports = QueueController;
