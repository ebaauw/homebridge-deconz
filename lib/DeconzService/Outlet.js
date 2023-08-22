// homebridge-deconz/lib/DeconzService/Outlet.js
// Copyright© 2022-2023 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const DeconzService = require('../DeconzService')

class Outlet extends DeconzService.LightsResource {
  constructor (accessory, resource, params = {}) {
    params.Service = accessory.Services.hap.Outlet
    super(accessory, resource, params)

    this.addCharacteristicDelegate({
      key: 'on',
      Characteristic: this.Characteristics.hap.On,
      value: this.capabilities.on
        ? this.resource.body.state.on
        : this.resource.body.state.all_on
    }).on('didSet', (value, fromHomeKit) => {
      if (fromHomeKit) {
        this.put({ on: value })
      }
    })

    if (this.resource.body.state.on === undefined) {
      this.addCharacteristicDelegate({
        key: 'anyOn',
        Characteristic: this.Characteristics.my.AnyOn,
        value: this.resource.body.state.any_on
      }).on('didSet', (value, fromHomeKit) => {
        if (fromHomeKit) {
          this.put({ on: value })
        }
      })
    }

    this.addCharacteristicDelegate({
      key: 'outletInUse',
      Characteristic: this.Characteristics.hap.OutletInUse,
      value: 1 // Eve interpretes OutletInUse as: device is physically plugged in.
    })

    if (this.resource.rtype === 'lights') {
      this.addCharacteristicDelegate({
        key: 'wallSwitch',
        value: false
      })
    }

    this.addCharacteristicDelegates()

    this.settings = {
      resetTimeout: this.platform.config.resetTimeout,
      waitTimeUpdate: this.platform.config.waitTimeUpdate,
      wallSwitch: false
    }
  }

  updateState (state) {
    for (const key in state) {
      const value = state[key]
      this.resource.body.state[key] = value
      switch (key) {
        case 'all_on':
          this.values.on = value
          break
        case 'any_on':
          this.values.anyOn = value
          break
        case 'on':
          if (this.values.wallSwitch && !state.reachable) {
            if (this.values.on) {
              this.log('not reachable: force On to false')
            }
            this.values.on = false
            break
          }
          this.values.on = value
          break
        default:
          break
      }
    }
    super.updateState(state)
  }
}

module.exports = Outlet
