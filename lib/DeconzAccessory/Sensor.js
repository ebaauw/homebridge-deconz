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

    switch (device.resource.serviceName) {
      case 'Daylight':
      case 'LightLevel':
        // Create dummy motion sensor service.
        this.motionService = new homebridgeLib.ServiceDelegate(this, {
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
    if (this.serviceByServiceName.Contact != null) {
      const service = this.serviceByServiceName.Contact
      params.contactDelegate = service.characteristicDelegate('contact')
      params.lastContactDelegate = this.service.addCharacteristicDelegate({
        key: 'lastActivation',
        Characteristic: this.Characteristics.eve.LastActivation,
        silent: true
      })
      params.timesOpenedDelegate = this.service.addCharacteristicDelegate({
        key: 'timesOpened',
        Characteristic: this.Characteristics.eve.TimesOpened,
        silent: true
      })
    }
    if (this.serviceByServiceName.Motion != null) {
      const service = this.serviceByServiceName.Motion
      params.motionDelegate = service.characteristicDelegate('motion')
      params.lastMotionDelegate = service.addCharacteristicDelegate({
        key: 'lastActivation',
        Characteristic: this.Characteristics.eve.LastActivation,
        silent: true
      })
    }
    if (this.serviceByServiceName.LightLevel != null) {
      const service = this.serviceByServiceName.LightLevel
      params.lightLevelDelegate = service.characteristicDelegate('lightLevel')
    }
    if (this.serviceByServiceName.Daylight != null) {
      const service = this.serviceByServiceName.Daylight
      params.lightLevelDelegate = service.characteristicDelegate('lightLevel')
    }
    if (this.serviceByServiceName.Temperature != null) {
      const service = this.serviceByServiceName.Temperature
      params.temperatureDelegate = service.characteristicDelegate('temperature')
    }
    if (this.serviceByServiceName.Humidity != null) {
      const service = this.serviceByServiceName.Humidity
      params.humidityDelegate = service.characteristicDelegate('humidity')
    }
    if (this.serviceByServiceName.AirPressure != null) {
      const service = this.serviceByServiceName.AirPressure
      params.airPressureDelegate = service.characteristicDelegate('airPressure')
    }
    if (this.serviceByServiceName.AirQuality != null) {
      const service = this.serviceByServiceName.AirQuality
      if (service.characteristicDelegate('vocDensity') != null) {
        params.vocDensityDelegate = service.characteristicDelegate('vocDensity')
      }
    }
    if (this.serviceByServiceName.Flag != null) {
      const service = this.serviceByServiceName.Flag
      params.switchOnDelegate = service.characteristicDelegate('on')
      params.lastSwitchOnDelegate = service.addCharacteristicDelegate({
        key: 'lastActivation',
        Characteristic: this.Characteristics.eve.LastActivation,
        silent: true
      })
    }
    if (Object.keys(params).length > 0) {
      this.historyService = new History(this, params)
    }

    setImmediate(() => {
      this.debug('initialised')
      this.emit('initialised')
    })
  }
}

module.exports = Sensor
