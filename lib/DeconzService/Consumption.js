// homebridge-deconz/lib/DeconzService/Consumption.js
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
class Consumption extends DeconzService.SensorsResource {
  static addResource (service, resource) {
    service.addCharacteristicDelegate({
      key: 'totalConsumption',
      Characteristic: service.Characteristics.eve.TotalConsumption,
      unit: ' kWh'
    })

    if (
      resource.body.state.power !== undefined &&
      service.values.currentConsumption === undefined
    ) {
      service.addCharacteristicDelegate({
        key: 'currentConsumption',
        Characteristic: service.Characteristics.eve.CurrentConsumption,
        unit: ' W'
      })
    }
  }

  static updateResourceState (service, state) {
    if (state.consumption != null) {
      service.values.totalConsumption = state.consumption / 1000
    }
    if (state.power != null) {
      service.values.currentConsumption = state.power
    }
    if (state.lastupdated != null) {
      service.values.lastUpdated = dateToString(state.lastupdated)
    }
  }

  constructor (accessory, resource, params = {}) {
    params.Service = accessory.Services.my.Resource
    super(accessory, resource, params)

    Consumption.addResource(this, resource)

    super.addCharacteristicDelegates()

    this.update(resource.body)
  }

  updateState (state) {
    Consumption.updateResourceState(this, state)
    super.updateState(state)
  }
}

module.exports = Consumption
