'use strict';

const fs = require('fs');
const path = require('path');
const {configureEnvVariables} = require('@statechannels/devtools');

const NODE_ENV = process.env.NODE_ENV;
if (!NODE_ENV) {
  throw new Error('The NODE_ENV environment variable is required but was not specified.');
}
configureEnvVariables();

// We support resolving modules according to `NODE_PATH`.
// This lets you use absolute paths in imports inside large monorepos:
// https://github.com/facebookincubator/create-react-app/issues/253.
// It works similar to `NODE_PATH` in Node itself:
// https://nodejs.org/api/modules.html#modules_loading_from_the_global_folders
// Note that unlike in Node, only *relative* paths from `NODE_PATH` are honored.
// Otherwise, we risk importing Node.js core modules into an app instead of Webpack shims.
// https://github.com/facebookincubator/create-react-app/issues/1023#issuecomment-265344421
// We also resolve them to make sure all tools using them work consistently.
const appDirectory = fs.realpathSync(process.cwd());
process.env.NODE_PATH = (process.env.NODE_PATH || '')
  .split(path.delimiter)
  .filter(folder => folder && !path.isAbsolute(folder))
  .map(folder => path.resolve(appDirectory, folder))
  .join(path.delimiter);

// Grab NODE_ENV and REACT_APP_* environment variables and prepare them to be
// injected into the application via DefinePlugin in Webpack configuration.
const REACT_APP = /^REACT_APP_/i;
// These are Magmo specific values that should be injected into the application
const MAGMO_VALUES = [
  'TARGET_NETWORK',
  'FIREBASE_URL',
  'FIREBASE_PROJECT',
  'FIREBASE_API_KEY',
  'WALLET_URL',
  'BOT_URL',
  'AUTO_PLAYER',
  'AUTO_OPPONENT',
];

const CONTRACT_ADDRESSES = /_ADDRESS$/i;

function getClientEnvironment(publicUrl) {
  const raw = Object.keys(process.env)
    .filter(key => {
      return REACT_APP.test(key) || CONTRACT_ADDRESSES.test(key) || MAGMO_VALUES.indexOf(key) > -1;
    })
    .reduce(
      (env, key) => {
        env[key] = process.env[key];
        return env;
      },
      {
        // Useful for determining whether we’re running in production mode.
        // Most importantly, it switches React into the correct mode.
        NODE_ENV: process.env.NODE_ENV || 'development',
        // Useful for resolving the correct path to static assets in `public`.
        // For example, <img src={process.env.PUBLIC_URL + '/img/logo.png'} />.
        // This should only be used as an escape hatch. Normally you would put
        // images into the `src` and `import` them in code to get their paths.
        PUBLIC_URL: publicUrl,

        BUILD_VERSION: new Date(Date.now()).toISOString(),
      }
    );
  // Stringify all values so we can feed into Webpack DefinePlugin
  const stringified = {
    'process.env': Object.keys(raw).reduce((env, key) => {
      env[key] = JSON.stringify(raw[key]);
      return env;
    }, {}),
  };
  return {
    raw,
    stringified,
  };
}

module.exports = getClientEnvironment;
