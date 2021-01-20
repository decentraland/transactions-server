#!/bin/sh

npm run migrate || exit 1
npm run start || exit 1
