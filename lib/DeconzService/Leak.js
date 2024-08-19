// homebridge-deconz/lib/DeconzService/Leak.js
// Copyright © 2022-2024 Erik Baauw. All rights reserved.
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
    if (state.water != null || state.test != null) {
      this.values.leak = state.water || state.test
        ? this.Characteristics.hap.LeakDetected.LEAK_DETECTED
        : this.Characteristics.hap.LeakDetected.LEAK_NOT_DETECTED
    }
    super.updateState(state)
  }
}

DeconzService.Leak = Leak
