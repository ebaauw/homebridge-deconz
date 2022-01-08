// homebridge-deconz/lib/DeconzService.js
// Copyright © 2022 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

/** Service delegates.
  * @hideconstructor
  */
class DeconzService {
  static get AirQuality () { return require('./DeconzService/AirQuality') }
  static get Alarm () { return require('./DeconzService/Alarm') }
  // static get Battery () { return require('./DeconzService/Battery') }
  static get Button () { return require('./DeconzService/Button') }
  // static get CarbonMonoxide () { return require('./DeconzService/CarbonMonoxide') }
  // static get Consumption () { return require('./DeconzService/Consumption') }
  // static get Daylight () { return require('./DeconzService/Daylight') }
  static get Device () { return require('./DeconzService/Device') }
  // static get Flag () { return require('./DeconzService/Flag') }
  // static get Fire () { return require('./DeconzService/Fire') }
  static get Gateway () { return require('./DeconzService/Gateway') }
  // static get Humidity () { return require('./DeconzService/Humidity') }
  // static get Light () { return require('./DeconzService/Light') }
  // static get LightBulb () { return require('./DeconzService/LightBulb') }
  // static get LightLevel () { return require('./DeconzService/LightLevel') }
  // static get Outlet () { return require('./DeconzService/Outlet') }
  // static get OpenClose () { return require('./DeconzService/OpenClose') }
  // static get Power () { return require('./DeconzService/Power') }
  // static get Presence () { return require('./DeconzService/Presence') }
  // static get Pressure () { return require('./DeconzService/Pressure') }
  static get Sensor () { return require('./DeconzService/Sensor') }
  // static get Status () { return require('./DeconzService/Status') }
  // static get Switch () { return require('./DeconzService/Switch') }
  // static get Temperature () { return require('./DeconzService/Temperature') }
  // static get Thermostat () { return require('./DeconzService/Thermostat') }
  // static get Vibration () { return require('./DeconzService/Vibration') }
  // static get Water () { return require('./DeconzService/Water') }
  // static get WarningDevice () { return require('./DeconzService/WarningDevice') }
  // static get WindowCovering () { return require('./DeconzService/WindowCovering') }
}

module.exports = DeconzService
