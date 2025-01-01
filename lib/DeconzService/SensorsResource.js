// homebridge-deconz/lib/DeconzService/SensorsResource.js
// Copyright © 2022-2025 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

import { timeout } from 'homebridge-lib'

import { ApiClient } from 'hb-deconz-tools/ApiClient'

import { DeconzService } from '../DeconzService/index.js'

const { dateToString } = ApiClient

/**
  * @memberof DeconzService
  */
class SensorsResource extends DeconzService {
  constructor (accessory, resource, params) {
    super(accessory, resource, params)

    this.updating = 0
    this.targetConfig = {}
  }

  addCharacteristicDelegates (params = {}) {
    if (!params.noLastUpdated) {
      this.addCharacteristicDelegate({
        key: 'lastUpdated',
        Characteristic: this.Characteristics.my.LastUpdated,
        silent: true
      })
    }

    this.addCharacteristicDelegate({
      key: 'enabled',
      Characteristic: this.Characteristics.my.Enabled
    }).on('didSet', async (value, fromHomeKit) => {
      this.values.statusActive = value
      if (fromHomeKit) {
        await this.put('/config', { on: value })
      }
    })

    this.addCharacteristicDelegate({
      key: 'statusActive',
      Characteristic: this.Characteristics.hap.StatusActive
    })

    if (this.resource.body.config.reachable !== undefined) {
      this.addCharacteristicDelegate({
        key: 'statusFault',
        Characteristic: this.Characteristics.hap.StatusFault
      })
    }

    if (this.resource.body.state.tampered !== undefined && !params.noTampered) {
      this.addCharacteristicDelegate({
        key: 'tampered',
        Characteristic: this.Characteristics.hap.StatusTampered
      })
    }
  }

  updateState (state) {
    if (state.lastupdated != null) {
      this.values.lastUpdated = dateToString(state.lastupdated)
    }
    if (state.tampered != null) {
      this.values.tampered = state.tampered
        ? this.Characteristics.hap.StatusTampered.TAMPERED
        : this.Characteristics.hap.StatusTampered.NOT_TAMPERED
    }
  }

  updateConfig (config) {
    if (config.on != null) {
      this.values.enabled = !!config.on
    }
    if (config.reachable != null) {
      this.values.statusFault = config.reachable
        ? this.Characteristics.hap.StatusFault.NO_FAULT
        : this.Characteristics.hap.StatusFault.GENERAL_FAULT
    }
  }

  async identify () {
    if (this.resource.body.config.alert) {
      return this.put('/config', { alert: 'select' })
    }
  }

  // Collect config changes into a combined request.
  async putConfig (config) {
    for (const key in config) {
      this.resource.body.config[key] = config[key]
      this.targetConfig[key] = config[key]
    }
    return this._putConfig()
  }

  // Send the request (for the combined config changes) to the gateway.
  async _putConfig () {
    try {
      if (this.platform.config.waitTimeUpdate > 0) {
        this.updating++
        await timeout(this.platform.config.waitTimeUpdate)
        if (--this.updating > 0) {
          return
        }
      }
      const targetConfig = this.targetConfig
      this.targetConfig = {}
      await this.put('/config', targetConfig)
      // this.recentlyUpdated = true
      // await timeout(500)
      // this.recentlyUpdated = false
    } catch (error) { this.warn(error) }
  }
}

DeconzService.SensorsResource = SensorsResource
