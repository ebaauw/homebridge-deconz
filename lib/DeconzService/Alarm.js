// homebridge-deconz/lib/DeconzService/Alarm.js
// Copyright © 2022-2026 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

import { DeconzService } from '../DeconzService/index.js'
import '../DeconzService/SensorsResource.js'

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
    if (state.test) {
      if (this.testTimout) {
        clearTimeout(this.testTimeout)
      }
      this.test = true
      this.testTimout = setTimeout(() => {
        delete this.testTimeout
        this.test = false
      }, 5000)
    }
    if (state.alarm) {
      this.values.alarm = true
    } else if (this.test) {
      this.values.alarm = true
    } else {
      this.values.alarm = false
    }
    super.updateState(state)
  }
}

DeconzService.Alarm = Alarm
