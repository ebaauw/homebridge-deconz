// homebridge-deconz/lib/DeconzService/Status.js
// Copyright © 2022-2026 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

import { DeconzService } from '../DeconzService/index.js'
import '../DeconzService/SensorsResource.js'

/**
  * @memberof DeconzService
  */
class Status extends DeconzService.SensorsResource {
  props (caps) {
    if (caps.min == null || caps.max == null) {
      return undefined
    }
    // Eve 3.1 displays the following controls, depending on the properties:
    // 1. {minValue: 0, maxValue: 1, minStep: 1}                    switch
    // 2. {minValue: a, maxValue: b, minStep: 1}, 1 < b - a <= 20   down|up
    // 3. {minValue: a, maxValue: b}, (a, b) != (0, 1)              slider
    // 4. {minValue: a, maxValue: b, minStep: 1}, b - a > 20        slider
    // Avoid the following bugs:
    // 5. {minValue: 0, maxValue: 1}                                nothing
    // 6. {minValue: a, maxValue: b, minStep: 1}, b - a = 1         switch*
    //    *) switch sends values 0 and 1 instead of a and b;
    if (caps.min === 0 && caps.max === 1) {
      // Workaround Eve bug (case 5 above).
      return { minValue: caps.min, maxValue: caps.max, minStep: 1 }
    }
    if (caps.max - caps.min === 1) {
      // Workaround Eve bug (case 6 above).
      return { minValue: caps.min, maxValue: caps.max }
    }
    return { minValue: caps.min, maxValue: caps.max, minStep: 1 }
  }

  constructor (accessory, resource, params = {}) {
    params.Service = accessory.Services.my.Status
    super(accessory, resource, params)

    if (resource.capabilities.readonly) {
      this.addCharacteristicDelegate({
        key: 'status',
        Characteristic: this.Characteristics.my.Status,
        props: {
          perms: [
            this.Characteristic.Perms.PAIRED_READ, this.Characteristic.Perms.NOTIFY
          ]
        }
      })
    } else {
      this.addCharacteristicDelegate({
        key: 'status',
        Characteristic: this.Characteristics.my.Status,
        props: this.props(resource.capabilities)
      }).on('didSet', async (value, fromHomeKit) => {
        if (fromHomeKit) {
          await this.put('/state', { status: value })
        }
      })
    }

    this.addCharacteristicDelegates()

    this.update(resource.body, resource.rpath)
  }

  updateState (state) {
    if (state.status != null) {
      this.values.status = state.status
    }
    super.updateState(state)
  }
}

DeconzService.Status = Status
