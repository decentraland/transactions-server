// THIS FILE SETS UP THE TESTING ENVIRONMENT

const { resolve } = require('path')
process.env.TS_NODE_PROJECT = resolve(__dirname, './tsconfig.json')

// register ts-node to parse ts-files directly with mocha
require('ts-node/register')
