// homebridge-deconz/lib/DeconzService/index.js
// Copyright © 2022 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

/** Service delegates.
  * @hideconstructor
  */
class DeconzService {
  static get AirQuality () { return require('./AirQuality') }
  static get Alarm () { return require('./Alarm') }
  // static get Battery () { return require('./Battery') }
  static get Button () { return require('./Button') }
  // static get CarbonMonoxide () { return require('./CarbonMonoxide') }
  // static get Consumption () { return require('./Consumption') }
  // static get Daylight () { return require('./Daylight') }
  static get DeviceSettings () { return require('./DeviceSettings') }
  // static get Flag () { return require('./Flag') }
  // static get Fire () { return require('./Fire') }
  static get GatewaySettings () { return require('./GatewaySettings') }
  // static get Humidity () { return require('./Humidity') }
  // static get Light () { return require('./Light') }
  static get Light () { return require('./Light') }
  // static get LightLevel () { return require('./LightLevel') }
  // static get Outlet () { return require('./Outlet') }
  // static get OpenClose () { return require('./OpenClose') }
  // static get Power () { return require('./Power') }
  // static get Presence () { return require('./Presence') }
  // static get Pressure () { return require('./Pressure') }
  static get Sensor () { return require('./Sensor') }
  // static get Status () { return require('./Status') }
  // static get Switch () { return require('./Switch') }
  // static get Temperature () { return require('./Temperature') }
  // static get Thermostat () { return require('./Thermostat') }
  // static get Vibration () { return require('./Vibration') }
  // static get Water () { return require('./Water') }
  // static get WarningDevice () { return require('./WarningDevice') }
  // static get WindowCovering () { return require('./WindowCovering') }
}

module.exports = DeconzService
