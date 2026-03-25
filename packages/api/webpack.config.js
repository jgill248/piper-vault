const path = require('path');
const nodeExternals = require('webpack-node-externals');
const { RunScriptWebpackPlugin } = require('run-script-webpack-plugin');

module.exports = function (options, webpack) {
  return {
    ...options,
    entry: ['webpack/hot/poll?100', options.entry],
    externals: [
      nodeExternals({
        // Bundle workspace packages so we avoid pnpm symlink / ESM resolution issues.
        allowlist: ['webpack/hot/poll?100', /^@delve\//],
      }),
      // Native Node addons and large ONNX/ML packages must stay external
      // — webpack cannot bundle .node binaries or WASM files.
      {
        'onnxruntime-node': 'commonjs onnxruntime-node',
        sharp: 'commonjs sharp',
        '@huggingface/transformers': 'commonjs @huggingface/transformers',
      },
    ],
    module: {
      rules: [
        {
          test: /\.ts$/,
          loader: 'ts-loader',
          options: {
            transpileOnly: true,
            // Allow ts-loader to compile workspace packages outside api/src
            allowTsInNodeModules: true,
          },
          exclude: /node_modules\/(?!@delve)/,
        },
      ],
    },
    resolve: {
      extensions: ['.ts', '.js'],
      // Map .js imports to .ts files (TypeScript ESM convention)
      extensionAlias: {
        '.js': ['.ts', '.js'],
      },
      alias: {
        '@delve/core': path.resolve(__dirname, '../core/src'),
        '@delve/shared': path.resolve(__dirname, '../shared/src'),
      },
    },
    plugins: [
      ...options.plugins,
      new webpack.HotModuleReplacementPlugin(),
      new RunScriptWebpackPlugin({
        name: options.output.filename,
        autoRestart: false,
      }),
    ],
  };
};
