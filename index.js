// homebridge-deconz/index.js
// Copyright © 2022 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const DeconzPlatform = require('./lib/DeconzPlatform')
const packageJson = require('./package.json')

module.exports = function (homebridge) {
  DeconzPlatform.loadPlatform(homebridge, packageJson, 'deCONZ', DeconzPlatform)
}
