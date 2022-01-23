// homebridge-deconz/lib/DeconzAccessory/Device.js
// Copyright © 2022 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const DeconzAccessory = require('.')
const DeconzService = require('../DeconzService')

/** Delegate class for a HomeKit accessory,
  * corresponding to a Zigbee or virtual device on a deCONZ gateway,
  * that is not yet supported.
  * @extends DeconzAccessory
  * @memberof DeconzAccessory
  */
class Device extends DeconzAccessory {
  /** Instantiate a delegate for an accessory corresponding to a device.
    * @param {DeconzAccessory.Gateway} gateway - The gateway.
    * @param {Deconz.Device} device - The device.
    */
  constructor (gateway, device) {
    super(gateway, device)

    this.identify()

    this.service = this.createService(device.resource, { primaryService: true })

    this.settingsService = new DeconzService.DeviceSettings(this, {
      name: this.name + ' Settings',
      subtype: this.id,
      resource: this.device.rpaths.join(', '),
      expose: true,
      logLevel: gateway.logLevel
    })
    this.manageLogLevel(this.settingsService.characteristicDelegate('logLevel'))

    setImmediate(() => {
      this.debug('initialised')
      this.emit('initialised')
    })
  }
}

module.exports = Device
