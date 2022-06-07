// homebridge-deconz/lib/DeconzAccessory/Motion.js
// Copyright © 2022 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const homebridgeLib = require('homebridge-lib')
const DeconzAccessory = require('../DeconzAccessory')

const { History } = homebridgeLib.ServiceDelegate

class Motion extends DeconzAccessory {
  /** Instantiate a delegate for an accessory corresponding to a device.
    * @param {DeconzAccessory.Gateway} gateway - The gateway.
    * @param {Deconz.Device} device - The device.
    */
  constructor (gateway, device) {
    super(gateway, device, gateway.Accessory.Categories.SENSOR)

    this.identify()

    this.service = this.createService(device.resource, { primaryService: true })

    for (const subtype in device.resourceBySubtype) {
      const resource = device.resourceBySubtype[subtype]
      if (subtype === device.primary) {
        continue
      }
      this.createService(resource)
    }

    this.historyService = new History.Motion(
      this, {},
      this.service.characteristicDelegate('motion'),
      this.service.characteristicDelegate('lastActivation'),
      this.serviceByServiceName.LightLevel == null
        ? null
        : this.serviceByServiceName.LightLevel.characteristicDelegate('lightlevel'),
      this.serviceByServiceName.Temperature == null
        ? null
        : this.serviceByServiceName.Temperature.characteristicDelegate('temperature')
    )

    this.createSettingsService()

    setImmediate(() => {
      this.debug('initialised')
      this.emit('initialised')
    })
  }
}

module.exports = Motion
