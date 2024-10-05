// homebridge-deconz/lib/DeconzService/Smoke.js
// Copyright © 2022-2024 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

import { DeconzService } from '../DeconzService/index.js'
import '../DeconzService/SensorsResource.js'

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
    let status = 0
    if (state.fire) {
      this.values.smoke = this.Characteristics.hap.SmokeDetected.SMOKE_DETECTED
      status |= this.Characteristics.eve.ElgatoDeviceStatus.SMOKE_DETECTED
    } else if (state.test) {
      this.values.smoke = this.Characteristics.hap.SmokeDetected.SMOKE_DETECTED
      status |= this.Characteristics.eve.ElgatoDeviceStatus.ALARM_TEST_ACTIVE
    } else {
      this.values.smoke = this.Characteristics.hap.SmokeDetected.SMOKE_NOT_DETECTED
    }
    this.values.deviceStatus = status
    super.updateState(state)
  }
}

DeconzService.Smoke = Smoke
