// homebridge-deconz/lib/DeconzService/AirQuality.js
// Copyright© 2022-2023 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const { ApiClient } = require('hb-deconz-tools')
const DeconzService = require('../DeconzService')

const { dateToString } = ApiClient

/**
  * @memberof DeconzService
  */
class AirQuality extends DeconzService.SensorsResource {
  static addResource (service, resource) {
    if (service.values.airQuality === undefined) {
      service.addCharacteristicDelegate({
        key: 'airQuality',
        Characteristic: service.Characteristics.hap.AirQuality
      })
    }

    if (resource.body.state.airqualityppb !== undefined) {
      service.addCharacteristicDelegate({
        key: 'vocDensity',
        Characteristic: service.Characteristics.hap.VOCDensity,
        unit: ' µg/m³',
        props: { minValue: 0, maxValue: 65535, minStep: 1 }
      })
    }

    if (resource.body.state.pm2_5 !== undefined) {
      service.addCharacteristicDelegate({
        key: 'pm25Density',
        Characteristic: service.Characteristics.hap.PM2_5Density,
        unit: ' µg/m³',
        props: { minValue: 0, maxValue: 65535, minStep: 1 }
      })
    }

    if (service.values.lastUpdated === undefined) {
      service.addCharacteristicDelegate({
        key: 'lastUpdated',
        Characteristic: service.Characteristics.my.LastUpdated,
        silent: true
      })
    }

    AirQuality.updateResourceState(service, resource.body.state)
  }

  static airQualityValue (service, value) {
    switch (value) {
      case 'excellent':
        return service.Characteristics.hap.AirQuality.EXCELLENT
      case 'good':
        return service.Characteristics.hap.AirQuality.GOOD
      case 'moderate':
        return service.Characteristics.hap.AirQuality.FAIR
      case 'poor':
        return service.Characteristics.hap.AirQuality.INFERIOR
      case 'unhealthy':
        return service.Characteristics.hap.AirQuality.POOR
      default:
        return service.Characteristics.hap.AirQuality.UNKNOWN
    }
  }

  static updateResourceState (service, state) {
    if (state.airqualityppb != null) {
      service.values.vocDensity = Math.round(state.airqualityppb * 4.57)
      if (state.airquality != null) {
        service.values.airQuality = AirQuality.airQualityValue(
          service, state.airquality
        )
      }
    }
    if (state.pm2_5 != null) {
      service.values.pm25Density = state.pm2_5
      if (state.airquality != null && service.values.vocDensity === undefined) {
        service.values.airQuality = AirQuality.airQualityValue(
          service, state.airquality
        )
      }
    }
    if (state.lastupdated != null) {
      service.values.lastUpdated = dateToString(state.lastupdated)
    }
  }

  constructor (accessory, resource, params = {}) {
    params.Service = accessory.Services.hap.AirQualitySensor
    super(accessory, resource, params)

    AirQuality.addResource(this, resource)

    super.addCharacteristicDelegates({ noLastUpdated: true })

    this.update(resource.body, resource.rpath)
  }

  updateState (state) {
    AirQuality.updateResourceState(this, state)
    super.updateState(state)
  }
}

module.exports = AirQuality
