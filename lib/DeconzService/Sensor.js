// homebridge-deconz/lib/DeconzService/Sensor.js
// Copyright © 2022 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const homebridgeLib = require('homebridge-lib')
const deconzClient = require('../deconzClient')

class Sensor extends homebridgeLib.ServiceDelegate {
  constructor (device, params = {}) {
    super(device, params)
    this.id = params.id
    this.platform = device.platform
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

  update (sensor) {
    this.values.lastUpdated = deconzClient.dateToString(sensor.state.lastupdated)
    this.values.enabled = sensor.config.on
    this.values.statusFault = sensor.config.reachable === false
      ? this.Characteristics.hap.StatusFault.GENERAL_FAULT
      : this.Characteristics.hap.StatusFault.NO_FAULT
  }

  async put (resource, body) {
    return this.client.put(this.resource + resource, body)
  }
}

module.exports = Sensor
