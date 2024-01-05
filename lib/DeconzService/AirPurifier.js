// homebridge-deconz/lib/DeconzService/AirPurifier.js
// Copyright © 2022-2024 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const DeconzService = require('../DeconzService')

class FilterMaintenance extends DeconzService.SensorsResource {
  constructor (accessory, resource, params = {}) {
    params.Service = accessory.Services.hap.FilterMaintenance
    super(accessory, resource, params)

    this.addCharacteristicDelegate({
      key: 'filterChange',
      Characteristic: this.Characteristics.hap.FilterChangeIndication
    })

    if (
      resource.body.config.filterlifetime !== undefined &&
      resource.body.state.filterruntime !== undefined
    ) {
      this.addCharacteristicDelegate({
        key: 'filterLifeLevel',
        Characteristic: this.Characteristics.hap.FilterLifeLevel,
        unit: '%'
      })
      this.addCharacteristicDelegate({
        key: 'resetFilter',
        Characteristic: this.Characteristics.hap.ResetFilterIndication,
        props: { adminOnlyAccess: [this.Characteristic.Access.WRITE] },
        value: 0
      }).on('didSet', async (value, fromHomeKit) => {
        await this.put('/config', { filterlifetime: 6 * 30 * 24 * 60 })
      })
      this.values.filterLifeTime = resource.body.config.filterlifetime
    }

    this.update(resource.body, resource.rpath)
  }

  updateState (state) {
    if (this.values.filterLifeTime != null && state.filterruntime != null) {
      this.values.filterLifeLevel = 100 - Math.round(
        100 * state.filterruntime / this.values.filterLifeTime
      )
    }
    if (state.replacefilter != null) {
      this.values.filterChange = state.replacefilter
        ? this.Characteristics.hap.FilterChangeIndication.CHANGE_FILTER
        : this.Characteristics.hap.FilterChangeIndication.FILTER_OK
    }
  }

  updateConfig (config) {
    if (config.filterlifetime != null) {
      this.values.filterLifeTime = config.filterlifetime
    }
  }
}

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
      this.airQualityService = new DeconzService.AirQuality(accessory, resource, {
        linkedServiceDelegate: this
      })
    }

    if (resource.body.state.replacefilter !== undefined) {
      this.filterService = new FilterMaintenance(accessory, resource, {
        linkedServiceDelegate: this
      })
    }

    if (resource.body.state.deviceruntime !== undefined) {
      // TODO
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

    this.update(resource.body, resource.rpath)
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
    if (this.filterService != null) {
      this.filterService.updateState(state)
    }
  }

  updateConfig (config) {
    if (config.filterlifetime != null) {
      this.values.filterLifeTime = config.filterlifetime
    }
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
    if (this.filterService != null) {
      this.filterService.updateConfig(config)
    }
  }
}

module.exports = AirPurifier
