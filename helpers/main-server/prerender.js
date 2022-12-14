require("colors");
const EventEmitter = require("events");
const { query } = require("./graphql");

class Prerenderer extends EventEmitter {
  /**@type {import('axios').AxiosResponse['data']|null} */
  #responseStream = null;

  async start() {
    console.info("Requesting prerender".green);

    const response = await query(
      `mutation Prerenderer($command:PRERENDERER_COMMAND!) {
        prerenderer( command: $command )
      }`,
      {
        command: "start",
      },
      {
        responseType: "stream",
      }
    );

    await new Promise((resolve) => {
      this.#responseStream = response.data;

      this.#responseStream.on("data", (data) => {
        console.log("DATA");
        console.log(data.toString());
      });

      this.#responseStream.on("end", (data) => {
        console.log("END");
        resolve("Response ends");
      });
    });
  }
}

const prerender = async () => {
  const prerenderer = new Prerenderer();

  await prerenderer.start();

  // return prerenderer;
};

module.exports = {
  prerender,
};
