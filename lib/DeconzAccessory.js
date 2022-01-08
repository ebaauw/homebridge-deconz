// homebridge-deconz/lib/DeconzAccessory.js
// Copyright © 2022 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

/** Accessory delegates.
  * @hideconstructor
  */
class DeconzAccessory {
  static get Gateway () { return require('./DeconzAccessory/Gateway') }
  static get Device () { return require('./DeconzAccessory/Device') }
}

module.exports = DeconzAccessory
