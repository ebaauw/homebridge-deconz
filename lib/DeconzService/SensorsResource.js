// homebridge-deconz/lib/DeconzService/SensorsResource.js
// Copyright© 2022-2023 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const { ApiClient } = require('hb-deconz-tools')
const DeconzService = require('../DeconzService')

const { dateToString } = ApiClient

/**
  * @memberof DeconzService
  */
class SensorsResource extends DeconzService {
  // constructor (accessory, resource, params) {
  //   super(accessory, resource, params)
  // }

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
}

module.exports = SensorsResource
