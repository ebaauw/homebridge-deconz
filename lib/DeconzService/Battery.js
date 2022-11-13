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
      name: accessory.name + ' Battery',
      exposeConfiguredName: true
    })
  }

  update (body) {
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
    }
    if (state.charging != null) {
      this.values.chargingState = state.charging
        ? this.Characteristics.hap.ChargingState.CHARGING
        : this.Characteristics.hap.ChargingState.NOT_CHARGING
    }
  }

  updateConfig (config) {
    if (config.battery != null) {
      this.values.batteryLevel = config.battery
    }
  }
}

module.exports = Battery
