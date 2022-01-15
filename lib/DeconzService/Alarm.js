// homebridge-deconz/lib/DeconzService/Alarm.js
// Copyright © 2022 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const DeconzService = require('../DeconzService')

/**
  * @memberof DeconzService
  */
class Alarm extends DeconzService.Sensor {
  constructor (deconzAccessory, params = {}) {
    params.Service = deconzAccessory.Services.hap.AirQualitySensor
    super(deconzAccessory, params)

    this.addCharacteristicDelegate({
      key: 'alarm',
      Characteristic: this.Characteristics.hap.my.Alamrm
    })
    super.addCharacteristicDelegates(params)
    this.update(params.sensor)
  }

  update (sensor) {
    this.value.alarm = sensor.state.alarm || sensor.state.test
    super.update(sensor)
  }
}

module.exports = Alarm
