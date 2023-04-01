// homebridge-deconz/lib/DeconzAccessory/Light.js
// Copyright© 2022-2023 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const { ServiceDelegate } = require('homebridge-lib')
const DeconzAccessory = require('../DeconzAccessory')

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
      value: device.resource.serviceName
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

    const params = {}
    if (this.values.serviceName === 'Outlet') {
      this.service.addCharacteristicDelegate({
        key: 'lockPhysicalControls',
        Characteristic: this.Characteristics.hap.LockPhysicalControls
      })
      params.onDelegate = this.service.characteristicDelegate('on')
      params.lastOnDelegate = this.service.addCharacteristicDelegate({
        key: 'lastActivation',
        Characteristic: this.Characteristics.eve.LastActivation,
        silent: true
      })
    } else {
      params.lightOnDelegate = this.service.characteristicDelegate('on')
      params.lastLightOnDelegate = this.service.addCharacteristicDelegate({
        key: 'lastActivation',
        Characteristic: this.Characteristics.eve.LastActivation,
        silent: true
      })
    }
    if (this.servicesByServiceName.Consumption?.[0] != null) {
      params.totalConsumptionDelegate = this.service.characteristicDelegate('totalConsumption')
      if (this.service.values.consumption === undefined) {
        // Power to be computed by history if not exposed by device
        params.computedConsumptionDelegate = this.service.addCharacteristicDelegate({
          key: 'consumption',
          Characteristic: this.Characteristics.eve.Consumption,
          unit: ' W'
        })
      }
    } else if (this.servicesByServiceName.Power?.[0] != null) {
      params.consumptionDelegate = this.service.characteristicDelegate('consumption')
      // Total Consumption to be computed by history
      params.computedTotalConsumptionDelegate = this.service.addCharacteristicDelegate({
        key: 'totalConsumption',
        Characteristic: this.Characteristics.eve.TotalConsumption,
        unit: ' kWh'
      })
    }
    this.historyService = new ServiceDelegate.History(this, params)

    setImmediate(() => {
      this.debug('initialised')
      this.emit('initialised')
    })
  }
}

module.exports = Light
