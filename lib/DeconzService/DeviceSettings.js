// homebridge-deconz/lib/DeconzService/DeviceSettings.js
// Copyright © 2022 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const homebridgeLib = require('homebridge-lib')
const DeconzAccessory = require('../DeconzAccessory')

/** Delegate class for a DeconzDevice service.
  * @extends ServiceDelegate
  * @memberof DeconzService
  */
class DeviceSettings extends homebridgeLib.ServiceDelegate {
  constructor (accessory, params = {}) {
    params.Service = accessory.Services.my.DeconzDevice
    params.exposeConfiguredName = true
    super(accessory, params)

    this.debug('settings: %j', params)

    this.addCharacteristicDelegate({
      key: 'expose',
      Characteristic: this.Characteristics.my.Expose,
      value: params.expose,
      silent: true
    }).on('didSet', (value) => {
      accessory.gateway.exposeDevice(params.subtype, value)
    })

    if (params.hasRepeat) {
      this.addCharacteristicDelegate({
        key: 'repeat',
        Characteristic: this.Characteristics.my.Repeat,
        props: { minValue: 0, maxValue: 1, minStep: 1 },
        value: 0
      })
    }

    if (params.logLevel != null) {
      this.addCharacteristicDelegate({
        key: 'logLevel',
        Characteristic: this.Characteristics.my.LogLevel,
        value: params.logLevel
      })
    }

    this.addCharacteristicDelegate({
      key: 'resource',
      Characteristic: this.Characteristics.my.Resource,
      value: params.resource,
      silent: true
    })

    if (!(accessory instanceof DeconzAccessory.Gateway)) {
      accessory.propertyDelegate('name')
        .on('didSet', (name) => {
          this.values.configuredName = name + ' Settings'
        })
    }
  }
}

module.exports = DeviceSettings
