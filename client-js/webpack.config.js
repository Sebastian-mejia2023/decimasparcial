const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = {
  mode: "production",
  entry: "./src/app.js",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "assets/js/app.[contenthash].js",
    publicPath: "/",
    clean: true
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: "./index.html",
      inject: "body",
      scriptLoading: "defer"
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: "styles.css", to: "assets/css/styles.css" },
        { from: "lib/Ice.min.js", to: "assets/js/Ice.min.js", info: { minimized: true } },
        { from: "src/services/ChessService.js", to: "assets/js/ChessService.js", info: { minimized: true } }
      ]
    })
  ]
};
