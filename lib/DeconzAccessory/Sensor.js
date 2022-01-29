// homebridge-deconz/lib/DeconzAccessory/Sensor.js
// Copyright © 2022 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const DeconzAccessory = require('../DeconzAccessory')

class Sensor extends DeconzAccessory {
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

    this.createSettingsService()

    setImmediate(() => {
      this.debug('initialised')
      this.emit('initialised')
    })
  }
}

module.exports = Sensor
