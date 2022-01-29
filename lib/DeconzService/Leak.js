// homebridge-deconz/lib/DeconzService/Leak.js
// Copyright © 2022 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const DeconzService = require('../DeconzService')

/**
  * @memberof DeconzService
  */
class Leak extends DeconzService.SensorsResource {
  constructor (accessory, resource, params = {}) {
    params.Service = accessory.Services.hap.LeakSensor
    super(accessory, resource, params)

    this.addCharacteristicDelegate({
      key: 'leak',
      Characteristic: this.Characteristics.hap.LeakDetected
    })

    super.addCharacteristicDelegates()

    this.update(resource.body)
  }

  updateState (state) {
    if (state.water != null || state.test != null) {
      this.values.leak = state.water || state.test
        ? this.Characteristics.hap.LeakDetected.LEAK_DETECTED
        : this.Characteristics.hap.LeakDetected.LEAK_NOT_DETECTED
    }
    super.updateState(state)
  }
}

module.exports = Leak
