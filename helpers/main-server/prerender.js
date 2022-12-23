require("colors");
const EventEmitter = require("events");
const { get } = require("./rest");

class Prerenderer extends EventEmitter {
  /**@type {import('axios').AxiosResponse['data']|null} */
  #responseStream = null;

  async start() {
    console.info("Requesting prerender".green);

    const response = await get(`/rest/prerender/start`, {
      responseType: "stream",
    });

    return new Promise((resolve) => {
      this.#responseStream = response.data;

      this.#responseStream.on("data", (data) => {
        console.log(data.toString("utf8"));
      });

      this.#responseStream.on("end", (data) => {
        resolve("Response ends");
      });
    });
  }
}

const prerender = async () => {
  const prerenderer = new Prerenderer();
  return await prerenderer.start();
};

module.exports = {
  prerender,
};
