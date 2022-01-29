// homebridge-deconz/lib/DeconzAccessory/WindowCovering.js
// Copyright © 2022 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const DeconzAccessory = require('../DeconzAccessory')

/** Delegate class for a HomeKit accessory, corresponding to a light device
  * or groups resource.
  * @extends DeconzAccessory
  * @memberof DeconzAccessory
  */
class WindowCovering extends DeconzAccessory {
  /** Instantiate a delegate for an accessory corresponding to a device.
    * @param {DeconzAccessory.Gateway} gateway - The gateway.
    * @param {Deconz.Device} device - The device.
    */
  constructor (gateway, device, settings = {}) {
    super(gateway, device, gateway.Accessory.Categories.WINDOW_COVERING)

    this.identify()

    this.service = this.createService(device.resource, {
      primaryService: true,
      serviceName: this.values.serviceName
    })

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

module.exports = WindowCovering
