// homebridge-deconz/lib/DeconzService/CarbonMonoxide.js
// Copyright © 2022-2026 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

import { DeconzService } from '../DeconzService/index.js'
import '../DeconzService/SensorsResource.js'

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
    if (state.carbonmonoxide) {
      this.values.carbonmonoxide = this.Characteristics.hap.CarbonMonoxideDetected.CO_LEVELS_ABNORMAL
    } else if (this.test) {
      this.values.carbonmonoxide = this.Characteristics.hap.CarbonMonoxideDetected.CO_LEVELS_ABNORMAL
    } else {
      this.values.carbonmonoxide = this.Characteristics.hap.CarbonMonoxideDetected.CO_LEVELS_NORMAL
    }
    super.updateState(state)
  }
}

DeconzService.CarbonMonoxide = CarbonMonoxide
