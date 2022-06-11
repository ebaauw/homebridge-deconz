// homebridge-deconz/lib/DeconzService/AirPurifier.js
// Copyright © 2022 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const DeconzService = require('../DeconzService')

/**
  * @memberof DeconzService
  */
class AirPurifier extends DeconzService.SensorsResource {
  constructor (accessory, resource, params = {}) {
    params.Service = accessory.Services.hap.AirPurifier
    super(accessory, resource, params)

    this.addCharacteristicDelegate({
      key: 'active',
      Characteristic: this.Characteristics.hap.Active
    }).on('didSet', async (value, fromHomeKit) => {
      if (fromHomeKit) {
        await this.put('/config', { mode: this.modeValue(value) })
      }
    })

    this.addCharacteristicDelegate({
      key: 'currentState',
      Characteristic: this.Characteristics.hap.CurrentAirPurifierState
    })

    this.addCharacteristicDelegate({
      key: 'targetState',
      Characteristic: this.Characteristics.hap.TargetAirPurifierState
    }).on('didSet', async (value, fromHomeKit) => {
      if (fromHomeKit) {
        await this.put('/config', { mode: this.modeValue(null, value) })
      }
    })

    this.addCharacteristicDelegate({
      key: 'rotationSpeed',
      Characteristic: this.Characteristics.hap.RotationSpeed,
      unit: '%'
    }).on('didSet', async (value, fromHomeKit) => {
      if (fromHomeKit) {
        await this.put('/config', { mode: this.modeValue(null, null, value) })
      }
    })

    if (resource.body.state.airquality !== undefined) {
      this.airQualityService = new DeconzService.AirQuality(accessory, resource)
    }

    if (resource.body.config.ledindication !== undefined) {
      // TODO
    }

    if (resource.body.config.locked !== undefined) {
      this.addCharacteristicDelegate({
        key: 'lockPhysicalControls',
        Characteristic: this.Characteristics.hap.LockPhysicalControls
      }).on('didSet', async (value, fromHomeKit) => {
        if (fromHomeKit) {
          await this.put('/config', {
            locked: value === this.Characteristics.hap.LockPhysicalControls
              .CONTROL_LOCK_ENABLED
          })
        }
      })
    }

    super.addCharacteristicDelegates()

    this.update(resource.body)
  }

  modeValue (
    active = this.values.active,
    targetState = this.values.targetState,
    rotationSpeed = this.values.rotationSpeed
  ) {
    if (active === this.Characteristics.hap.Active.INACTIVE) {
      return 'off'
    }
    if (
      targetState === this.Characteristics.hap.TargetAirPurifierState.AUTO ||
      rotationSpeed === 0
    ) {
      return 'auto'
    }
    return 'speed_' + Math.round(rotationSpeed / 20)
  }

  updateState (state) {
    if (state.speed != null) {
      this.values.active = state.speed > 0
        ? this.Characteristics.hap.Active.ACTIVE
        : this.Characteristics.hap.Active.INACTIVE
      this.values.currentState = state.speed === 0
        ? this.Characteristics.hap.CurrentAirPurifierState.INACTIVE
        : this.Characteristics.hap.CurrentAirPurifierState.PURIFYING_AIR
      this.values.rotationSpeed = state.speed
    }
    super.updateState(state)
    if (this.airQualityService != null) {
      this.airQualityService.updateState(state)
    }
  }

  updateConfig (config) {
    if (config.ledindication != null) {
      // TODO
    }
    if (config.locked != null) {
      this.values.lockPhysicalControls = config.locked
        ? this.Characteristics.hap.LockPhysicalControls.CONTROL_LOCK_ENABLED
        : this.Characteristics.hap.LockPhysicalControls.CONTROL_LOCK_DISABLED
    }
    if (config.mode != null) {
      this.values.targetState = config.mode === 'auto'
        ? this.Characteristics.hap.TargetAirPurifierState.AUTO
        : this.Characteristics.hap.TargetAirPurifierState.MANUAL
    }
    super.updateConfig(config)
    if (this.airQualityService != null) {
      this.airQualityService.updateConfig(config)
    }
  }
}

module.exports = AirPurifier
