/*
 *
 *
 *       Complete the API routing below
 *
 *
 */

"use strict";

var expect = require("chai").expect;
var MongoClient = require("mongodb");
const mongoose = require("mongoose");
const fetch = require("node-fetch");

//const CONNECTION_STRING = process.env.DB; //MongoClient.connect(CONNECTION_STRING, function(err, db) {});

mongoose
  .connect(process.env.DB, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .catch(error => {
    console.log("error in connecting to mongodb");
  });

//--create a new schema and model
const schema = mongoose.Schema;

const stockSchema = new schema({
  ticker: { type: String, required: true },
  likes: { type: Number, default: 0 },
  ip: { type: String, default: "" }
});

const Stock = mongoose.model("Stock", stockSchema);

module.exports = function(app) {
  app.set("trust proxy", true);
  app.route("/api/stock-prices").get(function(req, res) {
    const { stock, like } = req.query;
    //console.log(stock, like);

    //-- validate client input in URL for stock and like. Stock ticker validation will be done from the external resource

    if (like && !stock) {
      return res.send("enter a stock ticker symbol");
    }
    if (like && like != "true" && like != "false") {
      return res.send("like is a boolean and can be only true or false");
    }
    if (Array.isArray(stock) && stock.length > 2) {
      return res.send("only two stocks allowed in query of API endpoint");
    }
    //--make up the url and get the stock data
    var url = "";
    var stockData;
    var givenStocks = [];

    var getStockData = async function(url) {
      let respond = await fetch(url);
      let dataJson = await respond.json();
      return dataJson;
    };

    if (!Array.isArray(stock)) {
      givenStocks.push(stock);
    }
    if (Array.isArray(stock)) {
      givenStocks = [...stock];
    }

    let promise = [];
    for (var i = 0; i <= givenStocks.length - 1; i++) {
      url =
        "https://repeated-alpaca.glitch.me/v1/stock/" +
        givenStocks[i] +
        "/quote";
      promise[i] = getStockData(url);
    }

    Promise.all([...promise]).then(dataAll => {
      //console.log(dataAll);
      //-- stock symbol does not exists dataAll returns [ 'Unknown symbol' ]
      if (dataAll.indexOf("Unknown symbol") != -1) {
        return res.send(
          "unknown stock symbol.Ensure ticker symbol entered is correct"
        );
      }
      stockData = [];
      var likes = [];
      let queryPromise = [];

      for (var i = 0; i <= givenStocks.length - 1; i++) {
        let obj = {};
        obj.stock = dataAll[i].symbol;
        obj.price = dataAll[i].latestPrice;
        stockData.push(obj);
        queryPromise[i] = Stock.findOne({
          ticker: stockData[i].stock,
          ip: req.connection.remoteAddress
        }).exec();
      }
      Promise.all([...queryPromise]).then(docs => {
        //console.log(stockData)
        for (var i = 0; i <= givenStocks.length - 1; i++) {
          if (docs[i]) {
            //console.log(docs)
            if (like == "true" && docs[i].likes == 0) {
              docs[i].likes = 1;
              docs[i].save();
            }
            likes[i] = docs[i].likes;
            //return res.json({stockData:stockData});
          } else {
            //stockData[i].likes =0
            likes[i] = 0;
            if (like == "true") {
              likes[i] = 1;
            }
            var stockAdd = new Stock({
              ticker: stockData[i].stock,
              likes: likes[i],
              ip: req.connection.remoteAddress
            });
            stockAdd.save();
            //return res.json({stockData:stockData});
          }
        }
        //--Only two stocks are allowed. If more than two entered will not pass the validation above

        if (givenStocks.length == 1) {
          stockData[0].likes = likes[0];
          return res.json({ stockData: stockData[0] });
        }
        if (givenStocks.length == 2) {
          stockData[0].rel_likes = likes[0] - likes[1];
          stockData[1].rel_likes = likes[1] - likes[0];
          console.log(stockData);
          return res.json({ stockData: stockData });
        }
      });
    });
  });
};

