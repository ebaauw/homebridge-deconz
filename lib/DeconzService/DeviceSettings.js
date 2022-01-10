// homebridge-deconz/lib/DeconzService/DeviceSettings.js
// Copyright © 2022 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const homebridgeLib = require('homebridge-lib')

/** Delegate class for a DeconzDevice service.
  * @extends ServiceDelegate
  */
class DeviceSettings extends homebridgeLib.ServiceDelegate {
  constructor (deconzAccessory, params = {}) {
    params.Service = deconzAccessory.Services.my.DeconzDevice
    params.primaryService = true
    super(deconzAccessory, params)

    this.addCharacteristicDelegate({
      key: 'expose',
      Characteristic: this.Characteristics.my.Expose,
      value: params.expose,
      silent: true
    })

    this.addCharacteristicDelegate({
      key: 'resource',
      Characteristic: this.Characteristics.my.Resource,
      value: params.resource,
      silent: true
    })
  }
}

module.exports = DeviceSettings
