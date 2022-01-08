// homebridge-deconz/lib/DeconzService/AirQuality.js
// Copyright © 2022 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const DeconzService = require('../DeconzService')

class AirQuality extends DeconzService.Sensor {
  constructor (deconzAccessory, params = {}) {
    params.Service = deconzAccessory.Services.hap.AirQualitySensor
    super(deconzAccessory, params)

    this.addCharacteristicDelegate({
      key: 'airQuality',
      Characteristic: this.Characteristics.hap.AirQuality
    })
    this.addCharacteristicDelegate({
      key: 'vocDensity',
      Characteristic: this.Characteristics.hap.VOCDensity
    })
    super.addCharacteristicDelegates(params)
    this.update(params.sensor)
  }

  airQualityValue (value) {
    switch (value) {
      case 'excellent':
        return this.Characteristics.hap.AirQuality.EXCELLENT
      case 'good':
        return this.Characteristics.hap.AirQuality.GOOD
      case 'moderate':
        return this.Characteristics.hap.AirQuality.FAIR
      case 'poor':
        return this.Characteristics.hap.AirQuality.INFERIOR
      case 'unhealthy':
        return this.Characteristics.hap.AirQuality.POOR
      default:
        return this.Characteristics.hap.AirQuality.UNKNOWN
    }
  }

  update (sensor) {
    this.values.airQuality = this.airQualityValue(sensor.state.airquality)
    this.values.vocDensity = Math.round(sensor.state.airqualityppb * 4.56)
    super.update(sensor)
  }
}

module.exports = AirQuality
