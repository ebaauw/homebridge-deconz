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

    if (resource.body.state.airqualityppb !== undefined) {
      this.addCharacteristicDelegate({
        key: 'vocDensity',
        Characteristic: this.Characteristics.hap.VOCDensity,
        unit: ' µg/m³',
        props: { minValue: 0, maxValue: 65535, minStep: 1 }
      })
    }

    if (resource.body.state.pm2_5 !== undefined) {
      this.addCharacteristicDelegate({
        key: 'pm2_5Density',
        Characteristic: this.Characteristics.hap.PM2_5Density,
        unit: ' µg/m³',
        props: { minValue: 0, maxValue: 65535, minStep: 1 }
      })
    }

    if (params.linkedServiceDelegate == null) {
      super.addCharacteristicDelegates()
    }

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
    if (state.pm2_5 != null) {
      this.values.pm2_5Density = state.pm2_5
    }
    super.updateState(state)
  }
}

module.exports = AirQuality
