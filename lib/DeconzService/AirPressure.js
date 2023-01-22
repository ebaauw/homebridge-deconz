// homebridge-deconz/lib/DeconzService/AirPressure.js
// Copyright © 2022 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const DeconzService = require('../DeconzService')

/**
  * @memberof DeconzService
  */
class AirPressure extends DeconzService.SensorsResource {
  constructor (accessory, resource, params = {}) {
    params.Service = accessory.Services.eve.AirPressureSensor
    super(accessory, resource, params)

    this.addCharacteristicDelegate({
      key: 'airPressure',
      Characteristic: this.Characteristics.eve.AirPressure,
      unit: ' hPa'
    })

    this.addCharacteristicDelegate({
      key: 'elevation',
      Characteristic: this.Characteristics.eve.Elevation,
      value: 0
    })

    // this.addCharacteristicDelegate({
    //   key: 'trend',
    //   Characteristic: this.Characteristics.eve.WeatherTrend,
    //   value: 0
    // })

    this.addCharacteristicDelegates()

    this.update(resource.body, resource.rpath)
  }

  updateState (state) {
    if (state.pressure != null) {
      this.values.airPressure = Math.round(state.pressure * 10) / 10
    }
    // this.values.trend = Math.round(new Date().valueOf() / 60000) % 16
    super.updateState(state)
  }
}

module.exports = AirPressure
