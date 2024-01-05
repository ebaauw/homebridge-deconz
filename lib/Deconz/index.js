// homebridge-deconz/lib/Deconz/index.js
// Copyright © 2022-2024 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

/** Library to discover, monitor, and interact with a deCONZ gateway.
  * @hideconstructor
  */
class Deconz {
  static get Device () { return require('./Device') }
  static get Resource () { return require('./Resource') }
}

module.exports = Deconz
