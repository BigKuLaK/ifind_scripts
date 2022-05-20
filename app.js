var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
const fs = require("fs-extra");
var cors = require('cors')
const { SSL_KEY, SSL_CERTIFICATE, MAIN_SERVER_URL = '*' } = require("dotenv").config().parsed;

// SSL CREDENTIAL FILES
const sslKey = fs.readFileSync(SSL_KEY, "utf8");
const sslCertificate = fs.readFileSync(SSL_CERTIFICATE, "utf8");

// ROUTES
var mydealzRouter = require("./routes/mydealzRouter");
var indexRouter = require("./routes/index");
var usersRouter = require("./routes/users");
var ebayRouter = require("./routes/ebayRouter");
var aliExpressRouter = require("./routes/AliExpressRoute");
var amazonRouter = require("./routes/AmazonRoute");
var taskRouter = require("./routes/taskRoute");


// Workaround for certificates not recognized by Node
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

var app = express();

// Attach credentials data
app.credentials = { key: sslKey, cert: sslCertificate };

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "jade");

app.use(logger("dev"));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

// Whitelist Admin URL from CORS restriction
app.use(function (req, res, next) {
  // Website you wish to allow to connect
  res.setHeader('Access-Control-Allow-Origin', MAIN_SERVER_URL);

  // Request methods you wish to allow
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');

  // Request headers you wish to allow
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

  // Set to true if you need the website to include cookies in the requests sent
  // to the API (e.g. in case you use sessions)
  res.setHeader('Access-Control-Allow-Credentials', true);

  // Pass to next layer of middleware
  next();
});

app.use("/", indexRouter);
app.use("/users", usersRouter);
app.use("/ebay", ebayRouter);
app.use("/mydealz", mydealzRouter);
app.use("/amazon", amazonRouter);
app.use("/aliexpress", aliExpressRouter);
app.use("/task", taskRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render("error");
});

module.exports = app;
