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
      key: 'smoke',
      Characteristic: this.Characteristics.hap.SmokeDetected
    })

    this.addCharacteristicDelegate({
      key: 'deviceStatus',
      Characteristic: this.Characteristics.eve.ElgatoDeviceStatus
    })

    super.addCharacteristicDelegates(params)

    this.update(resource.body, resource.rpath)
  }

  updateState (state) {
    if (state.fire != null || state.test != null) {
      this.values.smoke = state.fire
        ? this.Characteristics.hap.SmokeDetected.SMOKE_DETECTED
        : this.Characteristics.hap.SmokeDetected.SMOKE_NOT_DETECTED
      let status = 0
      if (state.fire) {
        status |= this.Characteristics.eve.ElgatoDeviceStatus.SMOKE_DETECTED
      }
      if (state.test) {
        status |= this.Characteristics.eve.ElgatoDeviceStatus.ALARM_TEST_ACTIVE
      }
      this.values.deviceStatus = status
    }
    super.updateState(state)
  }
}

module.exports = Smoke
