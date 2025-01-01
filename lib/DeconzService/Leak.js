// homebridge-deconz/lib/DeconzService/Leak.js
// Copyright © 2022-2025 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

import { DeconzService } from '../DeconzService/index.js'
import '../DeconzService/SensorsResource.js'

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
    if (state.water) {
      this.values.leak = this.Characteristics.hap.LeakDetected.LEAK_DETECTED
    } else if (this.test) {
      this.values.leak = this.Characteristics.hap.LeakDetected.LEAK_DETECTED
    } else {
      this.values.leak = this.Characteristics.hap.LeakDetected.LEAK_NOT_DETECTED
    }
    super.updateState(state)
  }
}

DeconzService.Leak = Leak
