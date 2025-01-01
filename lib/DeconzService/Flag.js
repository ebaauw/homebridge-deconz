// homebridge-deconz/lib/DeconzService/Flag.js
// Copyright © 2022-2025 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

import { DeconzService } from '../DeconzService/index.js'
import '../DeconzService/SensorsResource.js'

/**
  * @memberof DeconzService
  */
class Flag extends DeconzService.SensorsResource {
  constructor (accessory, resource, params = {}) {
    params.Service = accessory.Services.hap.Switch
    super(accessory, resource, params)

    if (resource.capabilities.readonly) {
      this.addCharacteristicDelegate({
        key: 'on',
        Characteristic: this.Characteristics.hap.On,
        props: {
          perms: [
            this.Characteristic.Perms.READ, this.Characteristic.Perms.NOTIFY
          ]
        }
      })
    } else {
      this.addCharacteristicDelegate({
        key: 'on',
        Characteristic: this.Characteristics.hap.On
      }).on('didSet', async (value, fromHomeKit) => {
        if (fromHomeKit) {
          await this.put('/state', { flag: value })
        }
      })
    }

    this.addCharacteristicDelegates()

    this.update(resource.body, resource.rpath)
  }

  updateState (state) {
    if (state.flag != null) {
      this.values.on = state.flag
    }
    super.updateState(state)
  }
}

DeconzService.Flag = Flag
