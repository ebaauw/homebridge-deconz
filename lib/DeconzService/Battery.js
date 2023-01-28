// homebridge-deconz/lib/DeconzService/Battery.js
// Copyright© 2022-2023 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const Deconz = require('../Deconz')
const homebridgeLib = require('homebridge-lib')
const { dateToString } = Deconz.ApiClient

/**
  * @memberof DeconzService
  */
class Battery extends homebridgeLib.ServiceDelegate.Battery {
  constructor (accessory, resource, params = {}) {
    super(accessory, {
      name: accessory.name + ' Battery',
      exposeConfiguredName: true
    })

    if (resource.body.state.battery != null) {
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

module.exports = Battery
