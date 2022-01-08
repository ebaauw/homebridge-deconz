// homebridge-deconz/lib/DeconzService/Resource.js
// Copyright © 2022 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const homebridgeLib = require('homebridge-lib')

class Device extends homebridgeLib.ServiceDelegate {
  constructor (deconzAccessory, params = {}) {
    params.Service = deconzAccessory.Services.my.DeconzDevice
    params.primaryService = true
    super(deconzAccessory, params)

    this.addCharacteristicDelegate({
      key: 'expose',
      Characteristic: this.Characteristics.my.Expose,
      value: params.expose,
      silent: true
    }).on('didSet', (value) => {
      deconzAccessory.gateway.exposeDevice(
        params.subtype, value
      )
    })

    this.addCharacteristicDelegate({
      key: 'resource',
      Characteristic: this.Characteristics.my.Resource,
      value: params.resource,
      silent: true
    })
  }
}

module.exports = Device
