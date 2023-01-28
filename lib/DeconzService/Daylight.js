// homebridge-deconz/lib/DeconzService/Daylight.js
// Copyright© 2022-2023 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const DeconzService = require('../DeconzService')
const Deconz = require('../Deconz')

const { dateToString } = Deconz.ApiClient

const daylightEvents = {
  100: { name: 'Solar Midnight', period: 'Night' },
  110: { name: 'Astronomical Dawn', period: 'Astronomical Twilight' },
  120: { name: 'Nautical Dawn', period: 'Nautical Twilight' },
  130: { name: 'Dawn', period: 'Twilight' },
  140: { name: 'Sunrise', period: 'Sunrise' },
  150: { name: 'End Sunrise', period: 'Golden Hour' },
  160: { name: 'End Golden Hour', period: 'Day' },
  170: { name: 'Solar Noon', period: 'Day' },
  180: { name: 'Start Golden Hour', period: 'Golden Hour' },
  190: { name: 'Start Sunset', period: 'Sunset' },
  200: { name: 'Sunset', period: 'Twilight' },
  210: { name: 'Dusk', period: 'Nautical Twilight' },
  220: { name: 'Nautical Dusk', period: 'Astronomical Twilight' },
  230: { name: 'Astronomical Dusk', period: 'Night' }
}

// Eve uses the following thresholds:
const VERY_BRIGHT = 1000
const BRIGHT = 300
const NORMAL = 100
const DIM = 10
const DARK = 0

const daylightPeriods = {
  Night: { lightLevel: DARK, dark: true, daylight: false },
  'Astronomical Twilight': { lightLevel: DIM, dark: true, daylight: false },
  'Nautical Twilight': { lightLevel: DIM, dark: true, daylight: false },
  Twilight: { lightLevel: NORMAL, dark: false, daylight: false },
  Sunrise: { lightLevel: BRIGHT, dark: false, daylight: true },
  Sunset: { lightLevel: BRIGHT, dark: false, daylight: true },
  'Golden Hour': { lightLevel: BRIGHT, dark: false, daylight: true },
  Day: { lightLevel: VERY_BRIGHT, dark: false, daylight: true }
}

/**
  * @memberof DeconzService
  */
class Daylight extends DeconzService.SensorsResource {
  constructor (accessory, resource, params = {}) {
    params.Service = accessory.Services.hap.LightSensor
    super(accessory, resource, params)

    this.addCharacteristicDelegate({
      key: 'lightLevel',
      Characteristic: this.Characteristics.hap.CurrentAmbientLightLevel,
      unit: ' lux'
    })

    this.addCharacteristicDelegate({
      key: 'dark',
      Characteristic: this.Characteristics.my.Dark
    })

    this.addCharacteristicDelegate({
      key: 'daylight',
      Characteristic: this.Characteristics.my.Daylight
    })

    this.addCharacteristicDelegate({
      key: 'status',
      Characteristic: this.Characteristics.my.Status,
      props: {
        minValue: 100,
        maxValue: 230,
        perms: [
          this.Characteristic.Perms.READ,
          this.Characteristic.Perms.NOTIFY]
      },
      value: resource.body.state.status
    })

    this.addCharacteristicDelegate({
      key: 'lastEvent',
      Characteristic: this.Characteristics.my.LastEvent
    })

    this.addCharacteristicDelegate({
      key: 'period',
      Characteristic: this.Characteristics.my.Period
    })

    this.addCharacteristicDelegates()

    this.addCharacteristicDelegate({
      key: 'sunrise',
      Characteristic: this.Characteristics.my.Sunrise
    })

    this.addCharacteristicDelegate({
      key: 'sunset',
      Characteristic: this.Characteristics.my.Sunset
    })

    if (!resource.body.config.configured) {
      this.warn('%s: %s not configured', resource.rpath, resource.body.type)
    }

    this.update(resource.body, resource.rpath)
  }

  updateState (state) {
    if (state.status != null) {
      this.values.status = state.status
      const { name, period } = daylightEvents[state.status]
      this.values.lastEvent = name
      this.values.period = period
      const { lightLevel, dark, daylight } = daylightPeriods[period]
      this.values.lightLevel = lightLevel
      this.values.dark = dark
      this.values.daylight = daylight
    }
    if (state.sunrise != null) {
      this.values.sunrise = dateToString(state.sunrise)
    }
    if (state.sunset != null) {
      this.values.sunset = dateToString(state.sunset)
    }
    super.updateState(state)
  }
}

module.exports = Daylight
