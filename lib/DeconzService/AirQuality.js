// homebridge-deconz/lib/DeconzService/AirQuality.js
// Copyright © 2022 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const DeconzService = require('../DeconzService')

/**
  * @memberof DeconzService
  */
class AirQuality extends DeconzService.SensorsResource {
  constructor (accessory, resource, params = {}) {
    params.Service = accessory.Services.hap.AirQualitySensor
    super(accessory, resource, params)

    this.addCharacteristicDelegate({
      key: 'airQuality',
      Characteristic: this.Characteristics.hap.AirQuality
    })

    this.addCharacteristicDelegate({
      key: 'vocDensity',
      Characteristic: this.Characteristics.hap.VOCDensity,
      unit: ' µg/m³',
      props: { minValue: 0, maxValue: 65535, minStep: 1 }
    })

    super.addCharacteristicDelegates()

    this.update(resource.body)
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

  updateState (state) {
    if (state.airquality != null) {
      this.values.airQuality = this.airQualityValue(state.airquality)
    }
    if (state.airqualityppb != null) {
      this.values.vocDensity = Math.round(state.airqualityppb * 4.57)
    }
    super.updateState(state)
  }
}

module.exports = AirQuality
