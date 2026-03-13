// homebridge-deconz/lib/DeconzService/DoorLock.js
// Copyright © 2022-2026 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

import { DeconzService } from '../DeconzService/index.js'
import '../DeconzService/SensorsResource.js'

/**
  * @memberof DeconzService
  */
class DoorLock extends DeconzService.SensorsResource {
  constructor (accessory, resource, params = {}) {
    params.Service = accessory.Services.hap.LockMechanism
    super(accessory, resource, params)

    this.addCharacteristicDelegate({
      key: 'currentState',
      Characteristic: this.Characteristics.hap.LockCurrentState
    })
    this.addCharacteristicDelegate({
      key: 'targetState',
      Characteristic: this.Characteristics.hap.LockTargetState
    }).on('didSet', async (value, fromHomeKit) => {
      if (fromHomeKit) {
        await this.put('/config', {
          lock: value === this.Characteristics.hap.LockTargetState.SECURED
        })
        this.locking = new Date()
      }
    })
    this.addCharacteristicDelegates()

    this.update(resource.body, resource.rpath)
  }

  updateState (state) {
    if (state.lockstate != null) {
      this.values.currentState = state.lockestate === 'locked'
        ? this.Characteristics.hap.LockCurrentState.SECURED
        : this.Characteristics.hap.LockCurrentState.UNSECURED
    }
    super.updateState(state)
  }

  updateConfig (config) {
    if (config.lock != null && new Date() - this.locking >= 5000) {
      this.values.targetLockState = config.lock
        ? this.Characteristics.hap.LockTargetState.SECURED
        : this.Characteristics.hap.LockTargetState.UNSECURED
    }
    super.updateConfig(config)
  }
}

DeconzService.DoorLock = DoorLock
