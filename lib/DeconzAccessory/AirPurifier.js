// homebridge-deconz/lib/DeconzAccessory/Thermostat.js
// Copyright © 2022-2026 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

import { DeconzAccessory } from '../DeconzAccessory/index.js'

class AirPurifier extends DeconzAccessory {
  /** Instantiate a delegate for an accessory corresponding to a device.
    * @param {DeconzAccessory.Gateway} gateway - The gateway.
    * @param {Deconz.Device} device - The device.
    */
  constructor (gateway, device, settings = {}) {
    super(gateway, device, gateway.Accessory.Categories.AIR_PURIFIER)
    this.identify()

    this.service = this.createService(device.resource, { primaryService: true })

    for (const subtype in device.resourceBySubtype) {
      const resource = device.resourceBySubtype[subtype]
      if (subtype === device.primary) {
        continue
      }
      this.createService(resource)
    }

    setImmediate(() => {
      this.debug('initialised')
      this.emit('initialised')
    })
  }
}

DeconzAccessory.AirPurifier = AirPurifier
