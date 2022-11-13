// homebridge-deconz/lib/DeconzAccessory/Temperature.js
// Copyright © 2022 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const homebridgeLib = require('homebridge-lib')
const DeconzAccessory = require('../DeconzAccessory')

const { History } = homebridgeLib.ServiceDelegate

class Temperature extends DeconzAccessory {
  /** Instantiate a delegate for an accessory corresponding to a device.
    * @param {DeconzAccessory.Gateway} gateway - The gateway.
    * @param {Deconz.Device} device - The device.
    */
  constructor (gateway, device, settings = {}) {
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

    if (this.serviceByServiceName.AirQuality == null) {
      this.historyService = new History.Weather(this, {
        temperatureDelegate: this.service.characteristicDelegate('temperature'),
        humidityDelegate: this.serviceByServiceName.Humidity == null
          ? null
          : this.serviceByServiceName.Humidity.characteristicDelegate('humidity'),
        airPressureDelegate: this.serviceByServiceName.AirPressure == null
          ? null
          : this.serviceByServiceName.AirPressure.characteristicDelegate('airPressure')
      })
    } else {
      this.historyService = new History.Room(this, {
        temperatureDelegate: this.service.characteristicDelegate('temperature'),
        humidityDelegate: this.serviceByServiceName.Humidity == null
          ? null
          : this.serviceByServiceName.Humidity.characteristicDelegate('humidity'),
        airQualityDelegate: this.serviceByServiceName.AirQuality.characteristicDelegate('vocDensity')
      })
    }

    this.createSettingsService()

    setImmediate(() => {
      this.debug('initialised')
      this.emit('initialised')
    })
  }
}

module.exports = Temperature
