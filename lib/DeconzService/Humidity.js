// homebridge-deconz/lib/DeconzService/Humidity.js
// Copyright © 2022-2026 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

import { DeconzService } from '../DeconzService/index.js'
import '../DeconzService/SensorsResource.js'

/**
  * @memberof DeconzService
  */
class Humidity extends DeconzService.SensorsResource {
  constructor (accessory, resource, params = {}) {
    params.Service = accessory.Services.hap.HumiditySensor
    super(accessory, resource, params)

    this.addCharacteristicDelegate({
      key: 'humidity',
      Characteristic: this.Characteristics.hap.CurrentRelativeHumidity,
      unit: '%'
    })

    this.addCharacteristicDelegates()

    this.update(resource.body, resource.rpath)
  }

  updateState (state) {
    if (state.measured_value != null) {
      this.values.humidity = Math.round(state.measured_value * 10) / 10
    } else if (state.humidity != null) {
      this.values.humidity = Math.round(state.humidity / 10) / 10
    } else if (state.moisture != null) {
      this.values.humidity = Math.round(state.moisture / 10) / 10
    }
    super.updateState(state)
  }
}

DeconzService.Humidity = Humidity
