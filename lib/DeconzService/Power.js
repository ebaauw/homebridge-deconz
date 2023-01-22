// homebridge-deconz/lib/DeconzService/Power.js
// Copyright © 2022 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const Deconz = require('../Deconz')
const DeconzService = require('../DeconzService')

const { dateToString } = Deconz.ApiClient

/**
  * @memberof DeconzService
  */
class Power extends DeconzService.SensorsResource {
  static addResource (service, resource) {
    if (service.values.currentConsumption === undefined) {
      service.addCharacteristicDelegate({
        key: 'currentConsumption',
        Characteristic: service.Characteristics.eve.CurrentConsumption,
        unit: ' W'
      })
    }

    if (resource.body.state.current !== undefined) {
      service.addCharacteristicDelegate({
        key: 'electricCurrent',
        Characteristic: service.Characteristics.eve.ElectricCurrent,
        unit: ' A'
      })
    }

    if (resource.body.state.voltage !== undefined) {
      service.addCharacteristicDelegate({
        key: 'voltage',
        Characteristic: service.Characteristics.eve.Voltage,
        unit: ' V'
      })
    }

    if (service.values.lastUpdated === undefined) {
      service.addCharacteristicDelegate({
        key: 'lastUpdated',
        Characteristic: service.Characteristics.my.LastUpdated,
        silent: true
      })
    }
    service.update(resource.body, resource.rpath)
  }

  static updateResourceState (service, state) {
    if (state.power != null) {
      service.values.currentConsumption = state.power
    }
    if (state.current != null) {
      service.values.electricCurrent = state.current / 1000
    }
    if (state.voltage != null) {
      service.values.voltage = state.voltage
    }
    if (state.lastupdated != null) {
      service.values.lastUpdated = dateToString(state.lastupdated)
    }
  }

  constructor (accessory, resource, params = {}) {
    params.Service = accessory.Services.my.Resource
    super(accessory, resource, params)

    Power.addResource(this, resource)

    super.addCharacteristicDelegates({ noLastUpdated: true })

    this.update(resource.body, resource.rpath)
  }

  updateState (state) {
    Power.updateResourceState(this, state)
    super.updateState(state)
  }
}

module.exports = Power
