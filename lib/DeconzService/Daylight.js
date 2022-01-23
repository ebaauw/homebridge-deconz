// homebridge-deconz/lib/DeconzService/Daylight.js
// Copyright © 2022 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const DeconzService = require('../DeconzService')
const Deconz = require('../Deconz')

const { dateToString, lightLevelToLux } = Deconz.ApiClient

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

const daylightPeriods = {
  Night: { lightlevel: 0, daylight: false, dark: true },
  'Astronomical Twilight': { lightlevel: 100, daylight: false, dark: true },
  'Nautical Twilight': { lightlevel: 1000, daylight: false, dark: true },
  Twilight: { lightlevel: 10000, daylight: false, dark: false },
  Sunrise: { lightlevel: 15000, daylight: true, dark: false },
  Sunset: { lightlevel: 20000, daylight: true, dark: false },
  'Golden Hour': { lightlevel: 40000, daylight: true, dark: false },
  Day: { lightlevel: 65535, daylight: true, dark: false }
}

/**
  * @memberof DeconzService
  */
class Daylight extends DeconzService.SensorsResource {
  constructor (accessory, resource, settings = {}) {
    super(accessory, {
      name: accessory.name,
      Service: accessory.Services.hap.LightSensor,
      primaryService: settings.primaryService
    })

    this.addCharacteristicDelegate({
      key: 'lightlevel',
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
      }
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
  }

  updateState (state) {
    if (state.status != null) {
      this.values.status = state.status
      const { name, period } = daylightEvents[state.status]
      this.values.lastEvent = name
      this.values.period = period
      const { lightlevel } = daylightPeriods[period]
      this.values.lightlevel = lightLevelToLux(lightlevel)
    }
    if (state.dark != null) {
      this.values.dark = state.dark
    }
    if (state.daylight != null) {
      this.values.daylight = state.daylight
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
