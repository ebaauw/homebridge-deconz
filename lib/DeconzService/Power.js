// homebridge-deconz/lib/DeconzService/Power.js
// Copyright © 2022-2025 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

import { ApiClient } from 'hb-deconz-tools/ApiClient'

import { DeconzService } from '../DeconzService/index.js'
import '../DeconzService/SensorsResource.js'

const { dateToString } = ApiClient

/**
  * @memberof DeconzService
  */
class Power extends DeconzService.SensorsResource {
  static addResource (service, resource) {
    if (service.values.consumption === undefined) {
      service.addCharacteristicDelegate({
        key: 'consumption',
        Characteristic: service.Characteristics.eve.Consumption,
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

    Power.updateResourceState(service, resource.body.state)
  }

  static updateResourceState (service, state) {
    if (state.power != null) {
      service.values.consumption = state.power
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
    params.name = accessory.name + ' Consumption'
    params.Service = accessory.Services.eve.Consumption
    params.exposeConfiguredName = true
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

DeconzService.Power = Power
