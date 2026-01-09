// homebridge-deconz/lib/DeconzService/Battery.js
// Copyright © 2022-2026 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

import { ServiceDelegate } from 'homebridge-lib/ServiceDelegate'
import 'homebridge-lib/ServiceDelegate/Battery'

import { ApiClient } from 'hb-deconz-tools/ApiClient'

import { DeconzService } from '../DeconzService/index.js'

const { dateToString } = ApiClient

/**
  * @memberof DeconzService
  */
class Battery extends ServiceDelegate.Battery {
  constructor (accessory, resource, params = {}) {
    const batteryParams = {
      name: accessory.name + ' Battery',
      exposeConfiguredName: true
    }
    const state = resource.body.state
    const config = resource.body.config
    if (state.battery != null) {
      batteryParams.batteryLevel = state.battery
      batteryParams.lowBatteryThreshold = 20
      if (state.charging != null) {
        batteryParams.chargingState = state.charging
      }
    } else if (config.battery != null) {
      batteryParams.batteryLevel = config.battery
      batteryParams.lowBatteryThreshold = 20
    }
    super(accessory, batteryParams)

    if (state.battery != null) {
      this.addCharacteristicDelegate({
        key: 'lastUpdated',
        Characteristic: this.Characteristics.my.LastUpdated,
        silent: true
      })
    }

    this.update(resource.body, resource.rpath)
  }

  update (body, rpath) {
    if (this.updating) {
      return
    }
    if (body.config != null) {
      this.updateConfig(body.config)
    }
    if (body.state != null) {
      this.updateState(body.state)
    }
  }

  updateState (state) {
    if (state.battery != null) {
      this.values.batteryLevel = state.battery
      if (state.charging != null) {
        this.values.chargingState = state.charging
          ? this.Characteristics.hap.ChargingState.CHARGING
          : this.Characteristics.hap.ChargingState.NOT_CHARGING
      }
      this.values.lastUpdated = dateToString(state.lastupdated)
    }
  }

  updateConfig (config) {
    if (config.battery != null) {
      this.values.batteryLevel = config.battery
    }
  }
}

DeconzService.Battery = Battery
