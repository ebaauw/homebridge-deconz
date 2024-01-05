// homebridge-deconz/lib/DeconzService/CarbonMonoxide.js
// Copyright © 2022-2024 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const DeconzService = require('../DeconzService')

/**
  * @memberof DeconzService
  */
class CarbonMonoxide extends DeconzService.SensorsResource {
  constructor (accessory, resource, params = {}) {
    params.Service = accessory.Services.hap.CarbonMonoxideSensor
    super(accessory, resource, params)

    this.addCharacteristicDelegate({
      key: 'carbonmonoxide',
      Characteristic: this.Characteristics.hap.CarbonMonoxideDetected
    })

    super.addCharacteristicDelegates(params)

    this.update(resource.body, resource.rpath)
  }

  updateState (state) {
    if (state.carbonmonoxide != null || state.test != null) {
      this.values.carbonmonoxide = state.carbonmonoxide || state.test
        ? this.Characteristics.hap.CarbonMonoxideDetected.CO_LEVELS_ABNORMAL
        : this.Characteristics.hap.CarbonMonoxideDetected.CO_LEVELS_NORMAL
    }
    super.updateState(state)
  }
}

module.exports = CarbonMonoxide
