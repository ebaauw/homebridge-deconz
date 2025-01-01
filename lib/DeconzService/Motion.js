// homebridge-deconz/lib/DeconzService/Motion.js
// Copyright © 2022-2025 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

import { DeconzService } from '../DeconzService/index.js'
import '../DeconzService/SensorsResource.js'

/**
  * @memberof DeconzService
  */
class Motion extends DeconzService.SensorsResource {
  constructor (accessory, resource, params = {}) {
    params.Service = accessory.Services.hap.MotionSensor
    super(accessory, resource, params)

    this.durationKey = resource.body.config.delay != null ? 'delay' : 'duration'
    this.sensitivitymax = resource.body.config.sensitivitymax

    this.addCharacteristicDelegate({
      key: 'motion',
      Characteristic: this.Characteristics.hap.MotionDetected,
      value: false
    })

    if (resource.body.state.distance !== undefined) {
      this.addCharacteristicDelegate({
        key: 'distance',
        Characteristic: this.Characteristics.my.Distance,
        unit: ' cm',
        value: 0
      })
    }

    this.addCharacteristicDelegate({
      key: 'sensitivity',
      Characteristic: this.Characteristics.eve.Sensitivity
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

    if (resource.body.config.detectionrange !== undefined) {
      this.addCharacteristicDelegate({
        key: 'detectionRange',
        Characteristic: this.Characteristics.my.DetectionRange,
        unit: ' cm',
        value: 600
      }).on('didSet', async (value, fromHomeKit) => {
        if (fromHomeKit) {
          const detectionrange = Math.max(0, Math.min(value, 600))
          await this.putConfig({ detectionrange })
        }
      })
    }

    if (resource.body.config.resetpresence !== undefined) {
      this.addCharacteristicDelegate({
        key: 'reset',
        Characteristic: this.Characteristics.my.Reset,
        value: false
      }).on('didSet', async (value, fromHomeKit) => {
        if (fromHomeKit) {
          await this.put('/config', { resetpresence: value })
        }
      })
    }

    this.addCharacteristicDelegates()

    this.update(resource.body, resource.rpath)
  }

  updateState (state) {
    if (state.presence != null) {
      this.values.motion = state.presence
    }
    if (state.distance != null) {
      this.values.distance = state.distance
    }
    if (state.vibration != null) {
      this.values.motion = state.vibration
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
    if (config.detectionrange != null) {
      this.values.detectionRange = config.detectionrange
    }
    if (config.resetpresence != null) {
      this.values.reset = config.resetpresence
    }
    super.updateConfig(config)
  }
}

DeconzService.Motion = Motion
