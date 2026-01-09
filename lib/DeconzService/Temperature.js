// homebridge-deconz/lib/DeconzService/Temperature.js
// Copyright © 2022-2026 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

import { DeconzService } from '../DeconzService/index.js'
import '../DeconzService/SensorsResource.js'

/**
  * @memberof DeconzService
  */
class Temperature extends DeconzService.SensorsResource {
  constructor (accessory, resource, params = {}) {
    params.Service = accessory.Services.hap.TemperatureSensor
    super(accessory, resource, params)

    this.addCharacteristicDelegate({
      key: 'temperature',
      Characteristic: this.Characteristics.hap.CurrentTemperature,
      unit: '°C',
      props: {
        minValue: Math.round(resource.body.capabilities?.measured_value?.min ?? -40),
        maxValue: Math.round(resource.body.capabilities?.measured_value?.max ?? 100),
        minStep: 0.1
      },
      value: 0
    })

    this.addCharacteristicDelegate({
      key: 'offset',
      Characteristic: this.Characteristics.my.Offset,
      unit: '°C',
      props: { minValue: -5, maxValue: 5, minStep: 0.1 },
      value: 0
    }).on('didSet', async (value, fromHomeKit) => {
      if (fromHomeKit) {
        await this.put('/config', { offset: Math.round(value * 100) })
      }
    })

    this.addCharacteristicDelegate({
      key: 'displayUnits',
      Characteristic: this.Characteristics.hap.TemperatureDisplayUnits,
      value: this.Characteristics.hap.TemperatureDisplayUnits.CELSIUS
    })

    this.addCharacteristicDelegates()

    this.update(resource.body, resource.rpath)
  }

  updateState (state) {
    if (state.measured_value != null) {
      this.values.temperature = Math.round(state.measured_value * 10) / 10
    } else if (state.temperature != null) {
      this.values.temperature = Math.round(state.temperature / 10) / 10
    }
    super.updateState(state)
  }

  updateConfig (config) {
    if (config.offset != null) {
      this.values.offset = Math.round(config.offset / 10) / 10
    }
    super.updateConfig(config)
  }
}

DeconzService.Temperature = Temperature
