// homebridge-deconz/lib/DeconzAccessory/Sensor.js
// Copyright© 2022-2023 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

// Keep separate for Eve History
// Switch/Outlet/Lightbulb
// Stateless Programmable Switch (Eve button)
// Sensors

'use strict'

const { ServiceDelegate } = require('homebridge-lib')
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

    switch (device.resource.serviceName) {
      case 'Daylight':
      case 'LightLevel':
        // Create dummy motion sensor service.
        this.motionService = new ServiceDelegate(this, {
          name: this.name + ' Motion',
          Service: this.Services.hap.MotionSensor,
          hidden: true
        })
        this.motionService.addCharacteristicDelegate({
          key: 'motion',
          Characteristic: this.Characteristics.hap.MotionDetected,
          props: {
            perms: [
              this.Characteristic.Perms.PAIRED_READ,
              this.Characteristic.Perms.NOTIFY,
              this.Characteristic.Perms.HIDDEN
            ]
          },
          value: 0
        })
        break
      default:
        break
    }

    const params = {}
    if (this.servicesByServiceName.Contact?.length === 1) {
      const service = this.servicesByServiceName.Contact[0]
      params.contactDelegate = service.characteristicDelegate('contact')
      params.lastContactDelegate = service.addCharacteristicDelegate({
        key: 'lastActivation',
        Characteristic: this.Characteristics.eve.LastActivation,
        silent: true
      })
      params.timesOpenedDelegate = service.addCharacteristicDelegate({
        key: 'timesOpened',
        Characteristic: this.Characteristics.eve.TimesOpened,
        value: 0,
        silent: true
      })
    }
    if (this.servicesByServiceName.Motion?.length === 1) {
      const service = this.servicesByServiceName.Motion[0]
      params.motionDelegate = service.characteristicDelegate('motion')
      params.lastMotionDelegate = service.addCharacteristicDelegate({
        key: 'lastActivation',
        Characteristic: this.Characteristics.eve.LastActivation,
        silent: true
      })
    }
    if (this.servicesByServiceName.LightLevel?.length === 1) {
      const service = this.servicesByServiceName.LightLevel[0]
      params.lightLevelDelegate = service.characteristicDelegate('lightLevel')
    }
    if (this.servicesByServiceName.Daylight?.length === 1) {
      const service = this.servicesByServiceName.Daylight[0]
      params.lightLevelDelegate = service.characteristicDelegate('lightLevel')
    }
    if (this.servicesByServiceName.Temperature?.length === 1) {
      const service = this.servicesByServiceName.Temperature[0]
      params.temperatureDelegate = service.characteristicDelegate('temperature')
    }
    if (this.servicesByServiceName.Humidity?.length === 1) {
      const service = this.servicesByServiceName.Humidity[0]
      params.humidityDelegate = service.characteristicDelegate('humidity')
    }
    if (this.servicesByServiceName.AirPressure?.length === 1) {
      const service = this.servicesByServiceName.AirPressure[0]
      params.airPressureDelegate = service.characteristicDelegate('airPressure')
    }
    if (this.servicesByServiceName.AirQuality?.length >= 1) {
      const service = this.servicesByServiceName.AirQuality[0]
      if (service.characteristicDelegate('vocDensity') != null) {
        params.vocDensityDelegate = service.characteristicDelegate('vocDensity')
      }
    }
    if (this.servicesByServiceName.Flag?.length === 1) {
      const service = this.servicesByServiceName.Flag[0]
      params.onDelegate = service.characteristicDelegate('on')
      params.lastOnDelegate = service.addCharacteristicDelegate({
        key: 'lastActivation',
        Characteristic: this.Characteristics.eve.LastActivation,
        silent: true
      })
    }
    if (
      params.temperatureDelegate != null && params.humidityDelegate != null &&
      params.airPressureDelegate == null && params.vocDensityDelegate == null &&
      this.servicesByServiceName.Battery?.length === 1
    ) {
      // Eve would see this as an Eve Thermo Control.
      this.airPressureService = new ServiceDelegate(this, {
        name: this.name + ' Pressure',
        Service: this.Services.eve.AirPressureSensor,
        hidden: true
      })
      this.airPressureService.addCharacteristicDelegate({
        key: 'airPressure',
        Characteristic: this.Characteristics.eve.AirPressure,
        props: {
          perms: [
            this.Characteristic.Perms.PAIRED_READ,
            this.Characteristic.Perms.NOTIFY,
            this.Characteristic.Perms.HIDDEN
          ]
        },
        value: 0
      })
    }
    if (Object.keys(params).length > 0) {
      this.historyService = new ServiceDelegate.History(this, params)
    }

    setImmediate(() => {
      this.debug('initialised')
      this.emit('initialised')
    })
  }
}

module.exports = Sensor
