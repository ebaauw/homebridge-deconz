// homebridge-deconz/homebridge-ui/server.js
//
// Homebridge plug-in for deCONZ.
// Copyright © 2022 Erik Baauw. All rights reserved.

'use strict'

const {
  HomebridgePluginUiServer, RequestError
} = require('@homebridge/plugin-ui-utils')

class UiServer extends HomebridgePluginUiServer {
  constructor () {
    super()

    this.onRequest('/cachedAccessories', async (cachedAccessories) => {
      try {
        // console.log('%d accessories', cachedAccessories.length)
        const gateways = cachedAccessories.filter((accessory) => {
          return accessory.plugin === 'homebridge-deconz' &&
            accessory.context != null &&
            accessory.context.className === 'Gateway'
        })
        // console.log('%d gateways', gateways.length)
        const result = {}
        for (const gateway of gateways) {
          const { host, apiKey } = gateway.context
          if (apiKey != null) {
            result[host] = apiKey
          }
        }
        console.log('%d gateways: %j', Object.keys(result).length, result)
        return result
      } catch (error) {
        throw new RequestError(error)
      }
    })

    this.ready()
  }
}

new UiServer() // eslint-disable-line no-new
