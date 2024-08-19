// homebridge-deconz/lib/DeconzAccessory/Thermostat.js
// Copyright © 2022-2024 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

import { ServiceDelegate } from 'homebridge-lib/ServiceDelegate'
import 'homebridge-lib/ServiceDelegate/History'

import { DeconzAccessory } from '../DeconzAccessory/index.js'

class Thermostat extends DeconzAccessory {
  /** Instantiate a delegate for an accessory corresponding to a device.
    * @param {DeconzAccessory.Gateway} gateway - The gateway.
    * @param {Deconz.Device} device - The device.
    */
  constructor (gateway, device, settings = {}) {
    super(gateway, device, gateway.Accessory.Categories.THERMOSTAT)
    this.identify()

    this.service = this.createService(device.resource, { primaryService: true })

    for (const subtype in device.resourceBySubtype) {
      const resource = device.resourceBySubtype[subtype]
      if (subtype === device.primary) {
        continue
      }
      this.createService(resource)
    }

    if (device.resource.body.state.valve !== undefined) {
      this.historyService = new ServiceDelegate.History(this, {
        temperatureDelegate: this.service.characteristicDelegate('currentTemperature'),
        targetTemperatureDelegate: this.service.characteristicDelegate('targetTemperature'),
        valvePositionDelegate: this.service.characteristicDelegate('valvePosition')
      })
    }

    setImmediate(() => {
      this.debug('initialised')
      this.emit('initialised')
    })
  }
}

DeconzAccessory.Thermostat = Thermostat
