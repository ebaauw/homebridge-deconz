// homebridge-deconz/lib/DeconzService/Battery.js
// Copyright © 2022 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const homebridgeLib = require('homebridge-lib')
// const Deconz = require('../Deconz')

// const { dateToString } = Deconz.ApiClient

/**
  * @memberof DeconzService
  */
class Battery extends homebridgeLib.ServiceDelegate.Battery {
  constructor (accessory, resource, params = {}) {
    super(accessory, {
      name: accessory.name + ' Battery'
    })
  }

  updateState (state) {
    if (state.battery != null) {
      this.values.batteryLevel = state.battery
    }
    if (state.charging != null) {
      this.values.chargingState = state.charging
        ? this.Characteristics.hap.ChargingState.CHARGING
        : this.Characteristics.hap.ChargingState.NOT_CHARGING
    }
    super.updateState(state)
  }

  updateConfig (config) {
    if (config.battery != null) {
      this.values.batteryLevel = config.battery
    }
    super.updateConfig(config)
  }
}

module.exports = Battery
