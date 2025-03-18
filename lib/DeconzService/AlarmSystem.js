// homebridge-deconz/lib/DeconzService/AlarmSystem.js
// Copyright © 2022-2025 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

import { DeconzService } from '../DeconzService/index.js'

let mapsInitialised = false
const armModeMap = {}
const armStateMap = {}
const targetStateMap = {}

function initMaps (currentState, targetState) {
  if (mapsInitialised) {
    return
  }
  armStateMap.disarmed = currentState.DISARMED
  armStateMap.armed_away = currentState.AWAY_ARM
  armStateMap.armed_stay = currentState.STAY_ARM
  armStateMap.armed_night = currentState.NIGHT_ARM
  armStateMap.in_alarm = currentState.ALARM_TRIGGERED
  armModeMap.disarmed = targetState.DISARM
  armModeMap.armed_away = targetState.AWAY_ARM
  armModeMap.armed_stay = targetState.STAY_ARM
  armModeMap.armed_night = targetState.NIGHT_ARM
  targetStateMap[targetState.DISARM] = 'disarm'
  targetStateMap[targetState.AWAY_ARM] = 'arm_away'
  targetStateMap[targetState.STAY_ARM] = 'arm_stay'
  targetStateMap[targetState.NIGHT_ARM] = 'arm_night'
  mapsInitialised = true
}

/**
  * @memberof DeconzService
  */
class AlarmSystem extends DeconzService {
  constructor (accessory, resource, params = {}) {
    params.Service = accessory.Services.hap.SecuritySystem
    super(accessory, resource, params)

    initMaps(
      this.Characteristics.hap.SecuritySystemCurrentState,
      this.Characteristics.hap.SecuritySystemTargetState
    )
    this.addCharacteristicDelegate({
      key: 'currentState',
      Characteristic: this.Characteristics.hap.SecuritySystemCurrentState
    })
    this.addCharacteristicDelegate({
      key: 'targetState',
      Characteristic: this.Characteristics.hap.SecuritySystemTargetState
    }).on('didSet', async (value, fromHomeKit) => {
      if (fromHomeKit) {
        await this.put(`/${targetStateMap[value]}`, {
          code0: this.values.pin
        })
      }
    })
    this.addCharacteristicDelegate({
      key: 'alarmType',
      Characteristic: this.Characteristics.hap.SecuritySystemAlarmType
    })
    this.addCharacteristicDelegate({
      key: 'pin',
      value: '0000'
    })

    this.update(resource.body, resource.rpath)
  }

  updateState (state) {
    if (armStateMap[state.armstate] != null) {
      this.values.currentState = armStateMap[state.armstate]
    }
    this.values.alarmType = state.armstate === 'in_alarm'
      ? 1 // this.Characteristics.hap.SecuritySystemAlarmType.UNKNOWN
      : 0 // this.Characteristics.hap.SecuritySystemAlarmType.NO_ALARM
  }

  updateConfig (config) {
    if (armModeMap[config.armmode] != null) {
      this.values.targetState = armModeMap[config.armmode]
    }
  }
}

DeconzService.AlarmSystem = AlarmSystem
