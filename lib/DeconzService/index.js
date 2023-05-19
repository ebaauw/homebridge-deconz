// homebridge-deconz/lib/DeconzService/index.js
// Copyright© 2022-2023 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const { ServiceDelegate } = require('homebridge-lib')
const Deconz = require('../Deconz')

const { dateToString } = Deconz.ApiClient

/** Service delegates.
  * @extends ServiceDelegate
  */
class DeconzService extends ServiceDelegate {
  static get AirPressure () { return require('./AirPressure') }
  static get AirPurifier () { return require('./AirPurifier') }
  static get AirQuality () { return require('./AirQuality') }
  static get Alarm () { return require('./Alarm') }
  static get Battery () { return require('./Battery') }
  static get Button () { return require('./Button') }
  static get CarbonMonoxide () { return require('./CarbonMonoxide') }
  static get Consumption () { return require('./Consumption') }
  static get Contact () { return require('./Contact') }
  static get Daylight () { return require('./Daylight') }
  static get Flag () { return require('./Flag') }
  static get Gateway () { return require('./Gateway') }
  static get Humidity () { return require('./Humidity') }
  static get Label () { return require('./Label') }
  static get Leak () { return require('./Leak') }
  static get Light () { return require('./Light') }
  static get LightsResource () { return require('./LightsResource') }
  static get LightLevel () { return require('./LightLevel') }
  static get Motion () { return require('./Motion') }
  static get Outlet () { return require('./Outlet') }
  static get Power () { return require('./Power') }
  static get Schedule () { return require('./Schedule') }
  static get SensorsResource () { return require('./SensorsResource') }
  static get Status () { return require('./Status') }
  static get Smoke () { return require('./Smoke') }
  static get Switch () { return require('./Switch') }
  static get Temperature () { return require('./Temperature') }
  static get Thermostat () { return require('./Thermostat') }
  static get WarningDevice () { return require('./WarningDevice') }
  static get WindowCovering () { return require('./WindowCovering') }

  constructor (accessory, resource, params) {
    super(accessory, {
      id: resource.id,
      name: resource.body.name,
      Service: params.Service,
      subtype: resource.subtype,
      primaryService: params.primaryService,
      exposeConfiguredName: true
    })
    this.id = resource.id
    this.gateway = accessory.gateway
    this.accessory = accessory
    this.client = accessory.client
    this.resource = resource
    this.rtype = resource.rtype
    this.rid = resource.rid
    this.rpath = resource.rpath
    this.capabilities = resource.capabilities

    this.serviceNameByRpath = {}

    // this.characteristicDelegate('configuredName')
    //   .on('didSet', async (value, fromHomeKit) => {
    //     if (fromHomeKit && value != null && value !== '') {
    //       this.debug('PUT %s %j', this.rpath, { name: value })
    //       await this.client.put(this.rpath, { name: value })
    //     }
    //   })
  }

  addResource (resource) {
    this.serviceNameByRpath[resource.rpath] = resource.serviceName
    DeconzService[resource.serviceName].addResource(this, resource)
  }

  update (body, rpath) {
    if (this.updating) {
      return
    }
    const serviceName = this.serviceNameByRpath[rpath]
    if (serviceName != null) {
      if (body.state != null) {
        DeconzService[serviceName].updateResourceState(this, body.state)
      }
      return
    }
    // if (body.name != null) {
    //   this.values.configuredName = body.name.slice(0, 31).trim()
    // }
    if (body.lastseen != null && this.rtype === 'lights') {
      this.values.lastSeen = dateToString(body.lastseen)
    }
    if (body.config != null) {
      this.updateConfig(body.config)
      if (this.batteryService != null) {
        this.batteryService.updateConfig(body.config)
      }
    }
    if (body.state != null) {
      this.updateState(body.state, rpath)
    }
    if (this.rtype === 'groups') {
      if (body.action != null) {
        this.updateState(body.action, rpath, 'action')
      }
      if (body.scenes != null) {
        this.updateScenes(body.scenes)
      }
    }
  }
}

module.exports = DeconzService
