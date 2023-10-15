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

    if (
      resource.body.state.measured_value !== undefined &&
      resource.body.capabilities?.measured_value != null
    ) {
      const cmv = resource.body.capabilities.measured_value
      switch (cmv.substance) {
        case 'PM2.5':
          if (cmv.quantity !== 'density') {
            service.warn('%s: unsupported substance', cmv.quantity)
            break
          }
          if (cmv.unit !== 'ug/m^3') {
            service.warn('%s: unsupported unit', cmv.unit)
            break
          }
          service.addCharacteristicDelegate({
            key: 'pm25Density',
            Characteristic: service.Characteristics.hap.PM2_5Density,
            unit: ' µg/m³',
            props: { minValue: cmv.min, maxValue: cmv.max }
          })
          service.resources[resource.rpath] = {
            key: 'pm25Density',
            f: (v) => { return v }
          }
          break
        case 'tVOC':
          if (cmv.quantity !== 'level') {
            service.warn('%s: unsupported substance', cmv.quantity)
            break
          }
          if (cmv.unit !== 'ppb') {
            service.warn('%s: unsupported unit', cmv.unit)
            break
          }
          service.addCharacteristicDelegate({
            key: 'vocDensity',
            Characteristic: service.Characteristics.hap.VOCDensity,
            unit: ' µg/m³',
            props: {
              minValue: Math.floor(cmv.min * 4.57),
              maxValue: Math.ceil(cmv.max * 4.57)
            }
          })
          service.resources[resource.rpath] = {
            key: 'vocDensity',
            f: (v) => { return Math.round(v * 4.57) }
          }
          break
        default:
          service.warn('%s: unsupported substance', cmv.substance)
          break
      }
    } else if (resource.body.state.airqualityppb !== undefined) {
      service.addCharacteristicDelegate({
        key: 'vocDensity',
        Characteristic: service.Characteristics.hap.VOCDensity,
        unit: ' µg/m³',
        props: { minValue: 0, maxValue: 65535, minStep: 1 }
      })
    } else if (resource.body.state.pm2_5 !== undefined) {
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

  static updateResourceState (service, state, rpath) {
    if (state.measured_value != null && service.resources[rpath] != null) {
      const { key, f } = service.resources[rpath]
      service.values[key] = f(state.measured_value)
      if (
        state.airquality != null && (
          key === 'vocDensity' || service.values.vocDensity === undefined
        )
      ) {
        service.values.airQuality = AirQuality.airQualityValue(
          service, state.airquality
        )
      }
    } else if (state.airqualityppb != null) {
      service.values.vocDensity = Math.round(state.airqualityppb * 4.57)
      if (state.airquality != null) {
        service.values.airQuality = AirQuality.airQualityValue(
          service, state.airquality
        )
      }
    } else if (state.pm2_5 != null) {
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
    this.resources = {}

    AirQuality.addResource(this, resource)

    super.addCharacteristicDelegates({ noLastUpdated: true })

    this.update(resource.body, resource.rpath)
  }

  updateState (state, rpath) {
    AirQuality.updateResourceState(this, state, rpath)
    super.updateState(state)
  }
}

module.exports = AirQuality
