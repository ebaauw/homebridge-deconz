// homebridge-deconz/lib/DeconzService/Alarm.js
// Copyright© 2022-2023 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const DeconzService = require('../DeconzService')

/**
  * @memberof DeconzService
  */
class Alarm extends DeconzService.SensorsResource {
  constructor (accessory, resource, params = {}) {
    params.Service = accessory.Services.my.Resource
    super(accessory, resource, params)

    this.addCharacteristicDelegate({
      key: 'alarm',
      Characteristic: this.Characteristics.my.Alarm
    })

    super.addCharacteristicDelegates(params)

    this.update(resource.body, resource.rpath)
  }

  updateState (state) {
    if (state.alarm != null || state.test != null) {
      this.values.alarm = state.alarm || state.test
    }
    super.updateState(state)
  }
}

module.exports = Alarm
