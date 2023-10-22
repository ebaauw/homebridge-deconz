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

    if (this.values.serviceName === 'Valve') {
      // No history
    } else if (
      this.servicesByServiceName[this.values.serviceName].length > 1 ||
      this.values.serviceName === 'Light'
    ) {
      params.lightOnDelegate = this.service.characteristicDelegate('on')
      params.lastLightOnDelegate = this.service.addCharacteristicDelegate({
        key: 'lastActivation',
        Characteristic: this.Characteristics.eve.LastActivation,
        silent: true
      })
    } else { // Outlet or Switch
      if (this.values.serviceName === 'Outlet') {
        this.service.addCharacteristicDelegate({
          key: 'lockPhysicalControls',
          Characteristic: this.Characteristics.hap.LockPhysicalControls
        })
      }
      params.onDelegate = this.service.characteristicDelegate('on')
      params.lastOnDelegate = this.service.addCharacteristicDelegate({
        key: 'lastActivation',
        Characteristic: this.Characteristics.eve.LastActivation,
        silent: true
      })
    }

    if (this.servicesByServiceName.Consumption?.length === 1) {
      const service = this.servicesByServiceName.Consumption[0]
      params.totalConsumptionDelegate = service.characteristicDelegate('totalConsumption')
      if (service.values.consumption === undefined) {
        // Power to be computed by history if not exposed by device
        params.computedConsumptionDelegate = service.addCharacteristicDelegate({
          key: 'consumption',
          Characteristic: this.Characteristics.eve.Consumption,
          unit: ' W'
        })
      }
    } else if (this.servicesByServiceName.Power?.length === 1) {
      const service = this.servicesByServiceName.Power[0]
      params.consumptionDelegate = service.characteristicDelegate('consumption')
      // Total Consumption to be computed by history
      params.computedTotalConsumptionDelegate = service.addCharacteristicDelegate({
        key: 'totalConsumption',
        Characteristic: this.Characteristics.eve.TotalConsumption,
        unit: ' kWh'
      })
    }

    if (Object.keys(params).length > 0) {
      this.historyService = new ServiceDelegate.History(this, params)
    }

    if (this.servicesByServiceName[this.values.serviceName].length === 1) {
      if (
        this.values.serviceName === 'Outlet' &&
        this.servicesByServiceName.Consumption == null &&
        this.servicesByServiceName.Power == null
      ) {
        // Dumb Outlet
        const service = new ServiceDelegate(this, {
          name: this.name + ' Consumption',
          Service: this.Services.eve.Consumption,
          hidden: true
        })
        service.addCharacteristicDelegate({
          key: 'dummyTotalConsumption',
          Characteristic: this.Characteristics.eve.TotalConsumption,
          props: {
            perms: [
              this.Characteristic.Perms.PAIRED_READ,
              this.Characteristic.Perms.NOTIFY,
              this.Characteristic.Perms.HIDDEN
            ]
          },
          silent: true,
          value: 0
        })
      }
    } else {
      for (const i in this.servicesByServiceName[this.values.serviceName]) {
        const service = this.servicesByServiceName[this.values.serviceName][i]
        service.addCharacteristicDelegate({
          key: 'index',
          Characteristic: this.Characteristics.hap.ServiceLabelIndex,
          silent: true,
          value: Number(i) + 1
        })
        service.values.index = Number(i) + 1
        if (i === '0') {
          continue
        }
        this.historyService?.addLastOnDelegate(
          service.characteristicDelegate('on'),
          service.addCharacteristicDelegate({
            key: 'lastActivation',
            Characteristic: this.Characteristics.eve.LastActivation,
            silent: true
          })
        )
      }
    }

    setImmediate(() => {
      this.debug('initialised')
      this.emit('initialised')
    })
  }
}

module.exports = Light
