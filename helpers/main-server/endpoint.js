module.exports = [
  (process.env.MAIN_SERVER_URL || "https://www.ifindilu.de").replace(
    /\/+$/,
    ""
  ),
  "/graphql",
].join("");
