// homebridge-deconz/lib/DeconzService/GatewaySettings.js
// Copyright © 2022 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const homebridgeLib = require('homebridge-lib')

/** Delegate class for a DeconzGateway service.
  * @extends ServiceDelegate
  * @memberof DeconzService
  */
class GatewaySettings extends homebridgeLib.ServiceDelegate {
  constructor (gateway, params = {}) {
    params.Service = gateway.Services.my.DeconzGateway
    params.exposeConfiguredName = true
    super(gateway, params)
    this.gateway = gateway

    this.addCharacteristicDelegate({
      key: 'expose',
      Characteristic: this.Characteristics.my.Expose,
      value: true
    }).on('didSet', async (value, fromHomeKit) => {
      try {
        this.values.statusActve = value
        if (value) {
          await gateway.connect()
        } else if (fromHomeKit) {
          await gateway.reset()
        }
      } catch (error) { this.error(error) }
    })

    this.addCharacteristicDelegate({
      key: 'lights',
      Characteristic: this.Characteristics.my.ExposeLights,
      value: false
    }).on('didSet', (value) => { this.updateRtypes('lights', value) })

    this.addCharacteristicDelegate({
      key: 'sensors',
      Characteristic: this.Characteristics.my.ExposeSensors,
      value: false
    }).on('didSet', (value) => { this.updateRtypes('sensors', value) })

    this.addCharacteristicDelegate({
      key: 'groups',
      Characteristic: this.Characteristics.my.ExposeGroups,
      value: false
    }).on('didSet', (value) => { this.updateRtypes('groups', value) })

    this.addCharacteristicDelegate({
      key: 'schedules',
      Characteristic: this.Characteristics.my.ExposeSchedules,
      value: false
    })

    this.addCharacteristicDelegate({
      key: 'heartrate',
      Characteristic: this.Characteristics.my.Heartrate,
      value: 30
    })

    this.addCharacteristicDelegate({
      key: 'lastUpdated',
      Characteristic: this.Characteristics.my.LastUpdated,
      silent: true
    })

    this.addCharacteristicDelegate({
      key: 'logLevel',
      Characteristic: this.Characteristics.my.LogLevel,
      value: this.accessoryDelegate.logLevel
    })

    this.addCharacteristicDelegate({
      key: 'restart',
      Characteristic: this.Characteristics.my.Restart,
      value: false
    }).on('didSet', async (value, fromHomeKit) => {
      try {
        if (value) {
          try {
            await gateway.client.restart()
            this.values.search = false
            this.values.unlock = false
            return
          } catch (error) { this.warn(error) }
        }
        if (fromHomeKit) {
          await homebridgeLib.timeout(this.platform.config.waitTimeReset)
          this.values.restart = !value
        }
      } catch (error) { this.error(error) }
    })
    this.values.restart = false

    this.addCharacteristicDelegate({
      key: 'search',
      Characteristic: this.Characteristics.my.Search,
      value: false
    }).on('didSet', async (value, fromHomeKit) => {
      try {
        if (value) {
          try {
            await gateway.client.search()
            await homebridgeLib.timeout(120000)
            this.values.search = false
            return
          } catch (error) { this.warn(error) }
        }
        if (fromHomeKit) {
          await homebridgeLib.timeout(this.platform.config.waitTimeReset)
          this.values.search = !value
        }
      } catch (error) { this.error(error) }
    })
    this.values.search = false

    this.addCharacteristicDelegate({
      key: 'statusActve',
      Characteristic: this.Characteristics.hap.StatusActive,
      value: true,
      silent: true
    })

    this.addCharacteristicDelegate({
      key: 'transitionTime',
      Characteristic: this.Characteristics.my.TransitionTime,
      value: this.gateway.defaultTransitionTime
    })
    this.values.transitionTime = this.gateway.defaultTransitionTime

    this.addCharacteristicDelegate({
      key: 'unlock',
      Characteristic: this.Characteristics.my.Unlock,
      value: false
    }).on('didSet', async (value, fromHomeKit) => {
      try {
        if (value) {
          try {
            await gateway.client.unlock()
            await homebridgeLib.timeout(60000)
            this.values.unlock = false
            return
          } catch (error) { this.warn(error) }
        }
        if (fromHomeKit) {
          await homebridgeLib.timeout(this.platform.config.waitTimeReset)
          this.values.unlock = !value
        }
      } catch (error) { this.error(error) }
    })
    this.values.unlock = false
  }

  async updateRtypes (rtype, value) {
    const rtypes = this.gateway.values.rtypes.slice()
    if (value) {
      rtypes.push(rtype)
    } else {
      rtypes.splice(rtypes.indexOf(rtype), 1)
    }
    this.gateway.values.rtypes = rtypes
  }

  update (config) {
    this.values.expose = true
    this.values.lastUpdated = new Date().toString().slice(0, 24)
    this.values.restart = false
  }
}

module.exports = GatewaySettings
