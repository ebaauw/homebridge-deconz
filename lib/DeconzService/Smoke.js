// homebridge-deconz/lib/DeconzService/Smoke.js
// Copyright© 2022-2023 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const DeconzService = require('../DeconzService')

/**
  * @memberof DeconzService
  */
class Smoke extends DeconzService.SensorsResource {
  constructor (accessory, resource, params = {}) {
    params.Service = accessory.Services.hap.SmokeSensor
    super(accessory, resource, params)

    this.addCharacteristicDelegate({
      key: 'fire',
      Characteristic: this.Characteristics.hap.SmokeDetected
    })

    super.addCharacteristicDelegates(params)

    this.update(resource.body, resource.rpath)
  }

  updateState (state) {
    if (state.fire != null || state.test != null) {
      this.values.fire = state.fire || state.test
        ? this.Characteristics.hap.SmokeDetected.SMOKE_DETECTED
        : this.Characteristics.hap.SmokeDetected.SMOKE_NOT_DETECTED
    }
    super.updateState(state)
  }
}

module.exports = Smoke
