// homebridge-deconz/lib/DeconzAccessory/Sensor.js
// Copyright © 2022 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const homebridgeLib = require('homebridge-lib')
const DeconzAccessory = require('../DeconzAccessory')

const { History } = homebridgeLib.ServiceDelegate

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

    switch (device.resource.serviceName) {
      case 'Contact':
        this.historyService = new History.Contact(this, {
          contactDelegate: this.service.characteristicDelegate('contact'),
          timesOpenedDelegate: this.service.characteristicDelegate('timesOpened'),
          lastActivationDelegate: this.service.characteristicDelegate('lastActivation')
        })
        break
      case 'Daylight':
      case 'LightLevel':
        this.historyService = new History.LightLevel(this, {
          lightLevelDelegate: this.service.characteristicDelegate('lightlevel'),
          temperatureDelegate: this.serviceByServiceName.Temperature == null
            ? null
            : this.serviceByServiceName.Temperature.characteristicDelegate('temperature'),
          humidityDelegate: this.serviceByServiceName.Humidity == null
            ? null
            : this.serviceByServiceName.Humidity.characteristicDelegate('humidity')
        })
        break
      case 'Motion':
        this.historyService = new History.Motion(this, {
          motionDelegate: this.service.characteristicDelegate('motion'),
          lastActivationDelegate: this.service.characteristicDelegate('lastActivation'),
          lightLevelDelegate: this.serviceByServiceName.LightLevel == null
            ? null
            : this.serviceByServiceName.LightLevel.characteristicDelegate('lightlevel'),
          temperatureDelegate: this.serviceByServiceName.Temperature == null
            ? null
            : this.serviceByServiceName.Temperature.characteristicDelegate('temperature'),
          humidityDelegate: this.serviceByServiceName.Humidity == null
            ? null
            : this.serviceByServiceName.Humidity.characteristicDelegate('humidity')
        })
        break
      case 'Temperature':
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
            vocDensityDelegate: this.serviceByServiceName.AirQuality.characteristicDelegate('vocDensity')
          })
        }
        break
      default:
        break
    }

    setImmediate(() => {
      this.debug('initialised')
      this.emit('initialised')
    })
  }
}

module.exports = Sensor
