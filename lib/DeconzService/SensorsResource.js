// homebridge-deconz/lib/DeconzService/SensorsResource.js
// Copyright © 2022 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const homebridgeLib = require('homebridge-lib')
const Deconz = require('../Deconz')

const { dateToString } = Deconz.ApiClient

/**
  * @memberof DeconzService
  */
class SensorsResource extends homebridgeLib.ServiceDelegate {
  constructor (device, params = {}) {
    super(device, params)
    this.id = params.id
    this.gateway = device.gateway
    this.client = device.client
    this.rtype = '/sensors'
    this.rid = params.rid
    this.resouce = this.rtype + '/' + this.rid
  }

  addCharacteristicDelegates (params = {}) {
    this.addCharacteristicDelegate({
      key: 'lastUpdated',
      Characteristic: this.Characteristics.my.LastUpdated,
      silent: true
    })
    this.addCharacteristicDelegate({
      key: 'enabled',
      Characteristic: this.Characteristics.my.Enabled
    }).on('didSet', (value) => {
      this.values.statusActive = value
    })
    this.addCharacteristicDelegate({
      key: 'statusActive',
      Characteristic: this.Characteristics.hap.StatusActive
    })
    this.addCharacteristicDelegate({
      key: 'statusFault',
      Characteristic: this.Characteristics.hap.StatusFault
    })
  }

  update (body, rpath) {
    if (this.updating) {
      return
    }
    if (body.config != null) {
      this.updateConfig(body.config)
    }
    if (body.state != null) {
      this.updateState(body.state, rpath)
    }
  }

  updateState (state) {
    if (state.lastupdated != null) {
      this.values.lastUpdated = dateToString(state.lastupdated)
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

  async put (resource, body) {
    return this.client.put(this.resource + resource, body)
  }
}

module.exports = SensorsResource
