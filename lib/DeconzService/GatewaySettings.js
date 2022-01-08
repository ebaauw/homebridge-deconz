// homebridge-deconz/lib/DeconzService/GatewaySettings.js
// Copyright © 2022 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const homebridgeLib = require('homebridge-lib')

/** Delegate class for a DeconzGateway service.
  * @extends ServiceDelegate
  */
class GatewaySettings extends homebridgeLib.ServiceDelegate {
  constructor (gateway, params = {}) {
    params.name = gateway.name
    params.Service = gateway.Services.my.DeconzGateway
    super(gateway, params)

    this.addCharacteristicDelegate({
      key: 'expose',
      Characteristic: this.Characteristics.my.Expose,
      value: true
    }).on('didSet', async (value, fromHomeKit) => {
      try {
        if (value) {
          await gateway.connect()
        } else {
          await gateway.reset()
        }
      } catch (error) { this.error(error) }
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
      value: gateway.platform.logLevel
    }).on('didSet', (value) => {
      gateway.logLevel = value
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
          await homebridgeLib.timeout(500)
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
          await homebridgeLib.timeout(500)
          this.values.search = !value
        }
      } catch (error) { this.error(error) }
    })
    this.values.search = false

    this.addCharacteristicDelegate({
      key: 'transitiontime',
      Characteristic: this.Characteristics.my.TransitionTime,
      value: 0.4
    })

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
          await homebridgeLib.timeout(500)
          this.values.unlock = !value
        }
      } catch (error) { this.error(error) }
    })
    this.values.unlock = false

    this.addCharacteristicDelegate({
      key: 'host',
      value: params.host,
      silent: true
    }).on('didSet', (value) => {
      if (gateway.client != null) {
        gateway.client.host = value
      }
      if (gateway.wsClient != null) {
        gateway.wsClient.host = this.values.wsHost
      }
    })
    this.values.host = params.host

    this.addCharacteristicDelegate({
      key: 'username',
      silent: true
    }).on('didSet', (value) => {
      gateway.client.username = value
    })

    this.addCharacteristicDelegate({
      key: 'wsPort',
      value: 443,
      silent: true
    }).on('didSet', (value) => {
      if (gateway.wsClient != null) {
        gateway.wsClient.host = this.values.wsHost
      }
    })

    Object.defineProperty(this.values, 'wsHost', {
      configurable: true, // make sure we can delete it again
      get () {
        const { hostname } = homebridgeLib.OptionParser.toHost(
          'host', this.host
        )
        return hostname + ':' + this.wsPort
      }
    })
  }

  update (config) {
    if (config.UTC == null) {
      return
    }
    this.values.expose = true
    this.values.lastUpdated = new Date().toString().slice(0, 24)
    this.values.restart = false
    this.values.wsPort = config.websocketport
  }
}

module.exports = GatewaySettings
