// homebridge-deconz/lib/Deconz/index.js
// Copyright© 2022-2023 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

/** Library to discover, monitor, and interact with a deCONZ gateway.
  * @hideconstructor
  */
class Deconz {
  static get ApiClient () { return require('./ApiClient') }
  static get ApiError () { return require('./ApiError') }
  static get ApiResponse () { return require('./ApiResponse') }
  static get Device () { return require('./Device') }
  static get Discovery () { return require('./Discovery') }
  static get Resource () { return require('./Resource') }
  static get WsClient () { return require('./WsClient') }
}

module.exports = Deconz
