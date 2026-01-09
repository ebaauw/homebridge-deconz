// homebridge-deconz/lib/DeconzService/Consumption.js
// Copyright © 2022-2026 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

import { ApiClient } from 'hb-deconz-tools/ApiClient'

import { DeconzService } from '../DeconzService/index.js'
import '../DeconzService/SensorsResource.js'

const { dateToString } = ApiClient

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
      service.values.consumption === undefined
    ) {
      service.addCharacteristicDelegate({
        key: 'consumption',
        Characteristic: service.Characteristics.eve.Consumption,
        unit: ' W'
      })
    }

    if (service.values.lastUpdated === undefined) {
      service.addCharacteristicDelegate({
        key: 'lastUpdated',
        Characteristic: service.Characteristics.my.LastUpdated,
        silent: true
      })
    }

    Consumption.updateResourceState(service, resource.body.state)
  }

  static updateResourceState (service, state) {
    if (state.consumption != null) {
      service.values.totalConsumption = state.consumption / 1000
    }
    if (state.power != null) {
      service.values.consumption = state.power
    }
    if (state.lastupdated != null) {
      service.values.lastUpdated = dateToString(state.lastupdated)
    }
  }

  constructor (accessory, resource, params = {}) {
    params.name = accessory.name + ' Consumption'
    params.Service = accessory.Services.eve.Consumption
    params.exposeConfiguredName = true
    super(accessory, resource, params)

    Consumption.addResource(this, resource)

    super.addCharacteristicDelegates({ noLastUpdated: true })

    this.update(resource.body, resource.rpath)
  }

  updateState (state) {
    Consumption.updateResourceState(this, state)
    super.updateState(state)
  }
}

DeconzService.Consumption = Consumption
