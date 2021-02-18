const path = require('path');

module.exports = {
  entry: './benchmark.js',
  target: 'node',
  output: {
    libraryTarget: 'commonjs',
    path: path.join(__dirname, 'dist'),
    filename: 'bundle.js',
  },
  devtool: false,
  externals: {
    'aws-sdk': "require('aws-sdk')",
    saslprep: "require('saslprep')",
  },
  mode: 'production',
  optimization: {
    // We no not want to minimize our code.
    minimize: false,
  },
  performance: {
    // Turn off size warnings for entry points
    hints: false,
  },
  resolve: {
    extensions: ['.wasm', '.ts', '.tsx', '.mjs', '.cjs', '.js', '.json'],
  },
  module: {
    exprContextCritical: false,
    rules: [
      {
        test: /\.(js|ts)$/,
        loader: 'babel-loader',
        exclude: /node_modules/,
        options: {
          presets: [
            [
              '@babel/preset-env',
              {
                targets: {
                  node: '10.16',
                },
              },
            ],
          ],
        },
      },
    ],
  },
};
