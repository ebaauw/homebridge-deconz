// homebridge-deconz/index.js
// Copyright © 2022-2026 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

import { createRequire } from 'node:module'

import { DeconzPlatform } from './lib/DeconzPlatform.js'

const require = createRequire(import.meta.url)
const packageJson = require('./package.json')

function main (homebridge) {
  DeconzPlatform.loadPlatform(homebridge, packageJson, 'deCONZ', DeconzPlatform)
}

export { main as default }
