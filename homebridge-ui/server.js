// homebridge-deconz/homebridge-ui/server.js
//
// Homebridge plug-in for deCONZ.
// Copyright© 2022-2023 Erik Baauw. All rights reserved.

'use strict'

const { UiServer } = require('homebridge-lib')
const { Discovery } = require('hb-deconz-tools')

class DeconzUiServer extends UiServer {
  constructor () {
    super()

    this.onRequest('discover', async (params) => {
      if (this.discovery == null) {
        this.discovery = new Discovery({
          // forceHttp: this.config.forceHttp,
          // timeout: this.config.timeout
        })
        this.discovery
          .on('error', (error) => {
            this.log(
              '%s: request %d: %s %s', error.request.name,
              error.request.id, error.request.method, error.request.resource
            )
            this.warn(
              '%s: request %d: %s', error.request.name, error.request.id, error
            )
          })
          .on('request', (request) => {
            this.debug(
              '%s: request %d: %s %s', request.name,
              request.id, request.method, request.resource
            )
          })
          .on('response', (response) => {
            this.debug(
              '%s: request %d: %d %s', response.request.name,
              response.request.id, response.statusCode, response.statusMessage
            )
          })
          .on('found', (name, id, address) => {
            this.debug('%s: found %s at %s', name, id, address)
          })
          .on('searching', (host) => {
            this.debug('upnp: listening on %s', host)
          })
          .on('searchDone', () => { this.debug('upnp: search done') })
      }
      const configs = await this.discovery.discover()
      return configs
    })
    this.ready()
  }
}

new DeconzUiServer() // eslint-disable-line no-new
