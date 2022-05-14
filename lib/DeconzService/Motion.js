// homebridge-deconz/lib/DeconzService/Motion.js
// Copyright © 2022 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const DeconzService = require('../DeconzService')

/**
  * @memberof DeconzService
  */
class Motion extends DeconzService.SensorsResource {
  constructor (accessory, resource, params = {}) {
    params.Service = accessory.Services.hap.MotionSensor
    super(accessory, resource, params)

    this.durationKey = resource.body.config.delay !== null ? 'delay' : 'duration'
    this.sensitivitymax = resource.body.config.sensitivitymax

    this.addCharacteristicDelegate({
      key: 'motion',
      Characteristic: this.Characteristics.hap.MotionDetected,
      value: 0
    })

    this.addCharacteristicDelegate({
      key: 'sensitivity',
      Characteristic: this.Characteristics.eve.Sensitivity,
      value: this.Characteristics.hap.TemperatureDisplayUnits.CELSIUS
    }).on('didSet', async (value, fromHomeKit) => {
      if (fromHomeKit) {
        const sensitivity = value === this.Characteristics.eve.Sensitivity.HIGH
          ? this.sensitivitymax
          : value === this.Characteristics.eve.Sensitivity.LOW
            ? 0
            : Math.round(this.sensitivitymax / 2)
        await this.put('/config', { sensitivity })
      }
    })

    this.addCharacteristicDelegate({
      key: 'duration',
      Characteristic: this.Characteristics.eve.Duration,
      unit: 's'
    }).on('didSet', async (value, fromHomeKit) => {
      if (fromHomeKit) {
        const config = {}
        config[this.durationKey] =
          value === this.Characteristics.eve.Duration.VALID_VALUES[0] ? 0 : value
        await this.put('/config', config)
      }
    })

    this.addCharacteristicDelegate({
      key: 'lastActivation',
      Characteristic: this.Characteristics.eve.LastActivation,
      silent: true
    })

    this.addCharacteristicDelegates()

    this.update(resource.body)
  }

  updateState (state) {
    if (state.presence != null) {
      this.values.motion = state.presence
    }
    if (state.vibration != null) {
      this.values.motion = state.vibration
    }
    if (state.tampered != null) {
      this.values.tampered = state.tampered
    }
    super.updateState(state)
  }

  updateConfig (config) {
    if (config[this.durationKey] != null) {
      let duration
      for (const value of this.Characteristics.eve.Duration.VALID_VALUES) {
        duration = value
        if (config[this.durationKey] <= value) {
          break
        }
      }
      this.values.duration = duration
    }
    if (config.sensitivity != null) {
      this.values.sensitivity = config.sensitivity === this.sensitivitymax
        ? this.Characteristics.eve.Sensitivity.HIGH
        : config.sensitivity === 0
          ? this.Characteristics.eve.Sensitivity.LOW
          : this.Characteristics.eve.Sensitivity.MEDIUM
    }
    super.updateConfig(config)
  }
}

module.exports = Motion
