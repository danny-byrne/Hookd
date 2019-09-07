const path = require('path');
const webpack = require('webpack');
module.exports= {
  entry: './index.ts',
  output: {
    path: path.resolve(__dirname),
    filename: 'index.js'
  },
  target: 'node',
  mode: process.env.NODE_ENV,
  resolve: {
    modules: [path.join(__dirname, './node_modules')],
    extensions: ['.ts', '.tsx', '.js', '.jsx']
  },
  module: {
    rules: [
      {
        test: /\.tsx?/,
        exclude: /node_modules/,
        use: [
          {loader: 'ts-loader'}
        ]
      },
      {
        enforce: 'pre',
        test: /\.jsx?/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react', 
            {
              plugins: [
                '@babel/plugin-syntax-class-properties'
              ]
            }
           
          ]
          },
        }
      },
    ]
  },
  plugins: [
    new webpack.BannerPlugin({ banner: "#!/usr/bin/env node", raw: true})
  ],
  node:{
    __dirname: true,
  }
};