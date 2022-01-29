// homebridge-deconz/lib/DeconzAccessory/Light.js
// Copyright © 2022 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const homebridgeLib = require('homebridge-lib')
const DeconzAccessory = require('../DeconzAccessory')

const { History } = homebridgeLib.ServiceDelegate

/** Delegate class for a HomeKit accessory, corresponding to a light device
  * or groups resource.
  * @extends DeconzAccessory
  * @memberof DeconzAccessory
  */
class Light extends DeconzAccessory {
  /** Instantiate a delegate for an accessory corresponding to a device.
    * @param {DeconzAccessory.Gateway} gateway - The gateway.
    * @param {Deconz.Device} device - The device.
    */
  constructor (gateway, device, settings = {}) {
    super(gateway, device, gateway.Accessory.Categories.LIGHTBULB)

    this.identify()

    this.addPropertyDelegate({
      key: 'serviceName',
      value: device.resource.capabilities.bri ? 'Light' : 'Outlet'
    })

    this.service = this.createService(device.resource, {
      primaryService: true,
      serviceName: this.values.serviceName
    })

    for (const subtype in device.resourceBySubtype) {
      const resource = device.resourceBySubtype[subtype]
      if (subtype === device.primary) {
        continue
      }
      if (resource.rtype === 'lights') {
        this.createService(resource, { serviceName: this.values.serviceName })
      } else {
        this.createService(resource)
      }
    }

    if (this.serviceByServiceName.Consumption != null) {
      this.historyService = new History.Consumption(
        this, {},
        this.serviceByServiceName.Consumption.characteristicDelegate('totalConsumption'),
        this.serviceByServiceName.Consumption.characteristicDelegate('currentConsumption')
      )
    } else if (this.serviceByServiceName.Power != null) {
      this.historyService = new History.Power(
        this, {},
        this.serviceByServiceName.Power.characteristicDelegate('currentConsumption')
      )
    }

    this.createSettingsService()

    setImmediate(() => {
      this.debug('initialised')
      this.emit('initialised')
    })
  }
}

module.exports = Light
