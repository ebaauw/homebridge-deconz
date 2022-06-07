// homebridge-deconz/lib/DeconzService/LightLevel.js
// Copyright © 2022 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const DeconzService = require('../DeconzService')
const Deconz = require('../Deconz')

const { lightLevelToLux } = Deconz.ApiClient

/**
  * @memberof DeconzService
  */
class LightLevel extends DeconzService.SensorsResource {
  constructor (accessory, resource, params = {}) {
    params.Service = accessory.Services.hap.LightSensor
    super(accessory, resource, params)

    this.addCharacteristicDelegate({
      key: 'lightlevel',
      Characteristic: this.Characteristics.hap.CurrentAmbientLightLevel,
      unit: ' lux'
    })

    this.addCharacteristicDelegate({
      key: 'dark',
      Characteristic: this.Characteristics.my.Dark
    })

    this.addCharacteristicDelegate({
      key: 'daylight',
      Characteristic: this.Characteristics.my.Daylight
    })

    this.addCharacteristicDelegates()

    this.update(resource.body)
  }

  updateState (state) {
    if (state.lightlevel != null) {
      this.values.lightlevel = lightLevelToLux(state.lightlevel)
    }
    if (state.dark != null) {
      this.values.dark = state.dark
    }
    if (state.daylight != null) {
      this.values.daylight = state.daylight
    }
    super.updateState(state)
  }
}

module.exports = LightLevel
