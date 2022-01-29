// homebridge-deconz/lib/DeconzService/Thermostat.js
// Copyright © 2022 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const DeconzService = require('../DeconzService')

/**
  * @memberof DeconzService
  */
class Thermostat extends DeconzService.SensorsResource {
  constructor (accessory, resource, params = {}) {
    params.Service = accessory.Services.hap.TemperatureSensor
    super(accessory, resource, params)

    this.addCharacteristicDelegate({
      key: 'currentTemperature',
      Characteristic: this.Characteristics.hap.CurrentTemperature,
      unit: '°C',
      props: { minValue: -40, maxValue: 100, minStep: 0.1 },
      value: 0
    })

    this.addCharacteristicDelegate({
      key: 'targetTemperature',
      Characteristic: this.Characteristics.hap.TargetTemperature,
      unit: '°C',
      props: { minValue: 5, maxValue: 30, minStep: 0.5 },
      value: 0
    }).on('didSet', async (value, fromHomeKit) => {
      if (fromHomeKit) {
        await this.put('/config', { heatsetpoint: Math.round(value * 100) })
      }
    })

    if (resource.body.state.valve !== undefined) {
      this.addCharacteristicDelegate({
        key: 'valvePosition',
        Characteristic: this.Characteristics.eve.ValvePosition,
        unit: '%'
      })
    }

    this.addCharacteristicDelegate({
      key: 'currentState',
      Characteristic: this.Characteristics.hap.CurrentHeatingCoolingState,
      props: {
        validValues: [
          this.Characteristics.hap.CurrentHeatingCoolingState.OFF,
          this.Characteristics.hap.CurrentHeatingCoolingState.HEAT
        ]
      }
    })

    this.addCharacteristicDelegate({
      key: 'targetState',
      Characteristic: this.Characteristics.hap.TargetHeatingCoolingState,
      props: {
        validValues: [
          this.Characteristics.hap.TargetHeatingCoolingState.OFF,
          this.Characteristics.hap.TargetHeatingCoolingState.HEAT
        ]
      }
    }).on('didSet', async (value, fromHomeKit) => {
      if (fromHomeKit) {
        await this.put('/mode', {
          mode: value === this.Characteristics.hap.TargetHeatingCoolingState.OFF
            ? 'off'
            : this.capabilities.heatValue
        })
      }
    })

    this.addCharacteristicDelegate({
      key: 'offset',
      Characteristic: this.Characteristics.my.Offset,
      unit: '°C',
      value: 0
    }).on('didSet', async (value, fromHomeKit) => {
      if (fromHomeKit) {
        await this.put('/config', { offset: Math.round(value * 100) })
      }
    })

    this.addCharacteristicDelegate({
      key: 'displayUnits',
      Characteristic: this.Characteristics.hap.TemperatureDisplayUnits,
      value: this.Characteristics.hap.TemperatureDisplayUnits.CELSIUS
    })

    this.addCharacteristicDelegate({
      key: 'programData',
      Characteristic: this.Characteristics.eve.ProgramData,
      silent: true,
      value: Buffer.from('ff04f6', 'hex').toString('base64')
    })

    this.addCharacteristicDelegate({
      key: 'programCommand',
      Characteristic: this.Characteristics.eve.ProgramCommand,
      silent: true
    })

    if (resource.body.config.displayflipped !== undefined) {
      this.addCharacteristicDelegate({
        key: 'imageMirroring',
        Characteristic: this.Characteristics.hap.ImageMirroring
      }).on('didSet', async (value, fromHomeKit) => {
        if (fromHomeKit) {
          await this.put('/config', { displayflipped: value })
        }
      })
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

  updateState (state) {
    if (state.on != null) {
      this.values.currentState = state.on
        ? this.Characteristics.hap.CurrentHeatingCoolingState.HEAT
        : this.Characteristics.hap.CurrentHeatingCoolingState.OFF
    }
    if (state.temperature != null) {
      this.values.currentTemperature = Math.round(state.temperature / 10) / 10
    }
    if (state.valve != null) {
      this.values.valvePosition = Math.round(state.valve / 2.55)
    }
    super.updateState(state)
  }

  updateConfig (config) {
    if (config.displayflipped != null) {
      this.values.imageMirroring = config.displayflipped
    }
    if (config.heatsetpoint != null) {
      this.values.targetTemperature = Math.round(config.heatsetpoint / 50) / 2
    }
    if (config.locked != null) {
      this.values.lockPhysicalControls = config.locked
        ? this.Characteristics.hap.LockPhysicalControls.CONTROL_LOCK_ENABLED
        : this.Characteristics.hap.LockPhysicalControls.CONTROL_LOCK_DISABLED
    }
    if (config.mode != null) {
      this.values.targetState = config.mode === 'off'
        ? this.Characteristics.hap.TargetHeatingCoolingState.OFF
        : this.Characteristics.hap.TargetHeatingCoolingState.HEAT
    }
    if (config.offset != null) {
      this.values.offset = Math.round(config.offset / 10) / 10
    }
    super.updateConfig(config)
  }
}

module.exports = Thermostat
