// homebridge-deconz/homebridge-ui/server.js
//
// Homebridge plug-in for deCONZ.
// Copyright © 2022 Erik Baauw. All rights reserved.

'use strict'

const {
  HomebridgePluginUiServer // , RequestError
} = require('@homebridge/plugin-ui-utils')
const { HttpClient, formatError } = require('homebridge-lib')

class UiServer extends HomebridgePluginUiServer {
  constructor () {
    super()
    this.clients = {}

    this.onRequest('get', async (params) => {
      try {
        const { uiPort, path } = params
        const client = this.getClient(uiPort)
        const { body } = await client.get(path)
        return body
      } catch (error) {
        if (!(error instanceof HttpClient.HttpError)) {
          console.log(formatError(error))
        }
      }
    })

    this.onRequest('put', async (params) => {
      try {
        const { uiPort, path, body } = params
        const client = this.getClient(uiPort)
        const { response } = await client.put(path, body)
        return response
      } catch (error) {
        if (!(error instanceof HttpClient.HttpError)) {
          console.log(formatError(error))
        }
      }
    })

    this.ready()
  }

  getClient (uiPort) {
    if (this.clients[uiPort] == null) {
      this.clients[uiPort] = new HttpClient({
        host: 'localhost:' + uiPort,
        keepAlive: true
      })
      this.clients[uiPort]
        .on('error', (error) => {
          console.log('request %d: %s', error.request.id, formatError(error))
        })
    }
    return this.clients[uiPort]
  }
}

new UiServer() // eslint-disable-line no-new
