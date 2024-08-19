// homebridge-deconz/lib/DeconzService/Valve.js
// Copyright © 2022-2024 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

import { DeconzService } from '../DeconzService/index.js'
import '../DeconzService/LightsResource.js'

class Valve extends DeconzService.LightsResource {
  constructor (accessory, resource, params = {}) {
    params.Service = accessory.Services.hap.Valve
    super(accessory, resource, params)

    this.addCharacteristicDelegate({
      key: 'active',
      Characteristic: this.Characteristics.hap.Active,
      value: this.capabilities.on
        ? this.resource.body.state.on
        : this.resource.body.state.all_on
    }).on('didSet', async (value, fromHomeKit) => {
      try {
        if (fromHomeKit) {
          await this.put(this.statePath, { on: value === this.Characteristics.hap.Active.ACTIVE })
        }
        if (this.values.active) {
          this.values.inUse = this.Characteristics.hap.InUse.IN_USE
          if (this.values.setDuration > 0) {
            this.values.remainingDuration = this.values.setDuration
            this.autoInActive = new Date().valueOf() + this.values.setDuration * 1000
            this.autoInActiveTimeout = setTimeout(async () => {
              try {
                await this.put(this.statePath, { on: false })
              } catch (error) { this.warn(error) }
            }, this.values.setDuration * 1000)
          }
        } else {
          this.values.inUse = this.Characteristics.hap.InUse.NOT_IN_USE
          if (this.autoInActiveTimeout != null) {
            clearTimeout(this.autoInActiveTimeout)
            delete this.autoInActiveTimeout
            delete this.autoInActive
            this.values.remainingDuration = 0
          }
        }
      } catch (error) { this.warn(error) }
    })

    this.addCharacteristicDelegate({
      key: 'inUse',
      Characteristic: this.Characteristics.hap.InUse,
      value: this.Characteristics.hap.InUse.NOT_IN_USE
    })

    this.addCharacteristicDelegate({
      key: 'remainingDuration',
      Characteristic: this.Characteristics.hap.RemainingDuration,
      value: 0,
      props: {
        maxValue: 4 * 3600
      },
      getter: async () => {
        const remaining = this.autoInActive - new Date().valueOf()
        return remaining > 0 ? Math.round(remaining / 1000) : 0
      }
    })

    this.addCharacteristicDelegate({
      key: 'setDuration',
      Characteristic: this.Characteristics.hap.SetDuration,
      value: 300,
      props: {
        maxValue: 4 * 3600
      }
    })

    this.addCharacteristicDelegate({
      key: 'valveType',
      Characteristic: this.Characteristics.hap.ValveType,
      value: this.Characteristics.hap.ValveType.GENERIC_VALVE
    })

    if (this.resource.rtype === 'lights') {
      this.addCharacteristicDelegate({
        key: 'wallSwitch',
        value: false
      })
    }

    this.addCharacteristicDelegates()

    this.values.active = this.Characteristics.hap.Active.INACTIVE
  }

  updateState (state) {
    for (const key in state) {
      const value = state[key]
      this.resource.body.state[key] = value
      switch (key) {
        case 'on':
          if (this.values.wallSwitch && !state.reachable) {
            this.log('not reachable: force Active to false')
            this.values.active = this.Characteristics.hap.Active.INACTIVE
            this.values.inUse = this.Characteristics.hap.InUse.NOT_IN_USE
            break
          }
          // falls through
        case 'all_on':
          this.values.active = value
            ? this.Characteristics.hap.Active.ACTIVE
            : this.Characteristics.hap.Active.INACTIVE
          this.values.inUse = value
            ? this.Characteristics.hap.InUse.IN_USE
            : this.Characteristics.hap.InUse.NOT_IN_USE
          break
        default:
          break
      }
    }
    super.updateState(state)
  }
}

DeconzService.Valve = Valve
