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
    // settings.forceEveEnergy = true

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

    let nLights = 1
    for (const subtype in device.resourceBySubtype) {
      const resource = device.resourceBySubtype[subtype]
      if (subtype === device.primary) {
        continue
      }
      if (resource.rtype === 'lights') {
        nLights++
        this.createService(resource, { serviceName: this.values.serviceName })
      } else {
        this.createService(resource)
      }
    }

    if (this.serviceByServiceName.Consumption != null) {
      // Current Consumption to be computed by history if not exposed by device
      const currentConsumption =
        this.service.values.currentConsumption === undefined
          ? this.service.addCharacteristicDelegate({
            key: 'currentConsumption',
            Characteristic: this.Characteristics.eve.CurrentConsumption,
            unit: ' W'
          })
          : null
      this.historyService = new History.Consumption(
        this, {},
        this.service.characteristicDelegate('totalConsumption'),
        currentConsumption,
        this.service.characteristicDelegate('on')
      )
    } else if (this.serviceByServiceName.Power != null) {
      // Total Consumption to be computed by history
      const TotalConsumption = this.service.addCharacteristicDelegate({
        key: 'totalConsumption',
        Characteristic: this.Characteristics.eve.TotalConsumption,
        unit: ' kWh',
        value: 0
      })
      this.historyService = new History.Power(
        this, {},
        this.service.characteristicDelegate('currentConsumption'),
        TotalConsumption,
        this.service.characteristicDelegate('on')
      )
    } else if (this.values.serviceName === 'Outlet' && settings.forceEveEnergy) {
      if (nLights > 1) {
        // Eve would recognise device as Eve Energy Strip.
      } else if (this.serviceByServiceName.Switch != null) {
        // Eve would recognise device as Eve Button.
      } else {
        // Needed for Eve to recognise device as Eve Energy.
        this.service.addCharacteristicDelegate({
          key: 'totalConsumption',
          Characteristic: this.Characteristics.eve.TotalConsumption,
          unit: ' kWh'
        })
        this.historyService = new History.On(
          this, {},
          this.service.characteristicDelegate('on')
        )
      }
    }

    if (this.values.serviceName === 'Outlet' && this.historyService != null) {
      if (nLights > 1) {
        // Eve would recognise device as Eve Energy Strip.
      } else if (this.serviceByServiceName.Switch != null) {
        // Eve would recognise device as Eve Button.
      } else {
        // Needed for Eve to show history for On.
        this.service.addCharacteristicDelegate({
          key: 'lockPhysicalControls',
          Characteristic: this.Characteristics.hap.LockPhysicalControls
        })
      }
    }

    this.createSettingsService()

    setImmediate(() => {
      this.debug('initialised')
      this.emit('initialised')
    })
  }
}

module.exports = Light
