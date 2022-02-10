// homebridge-deconz/homebridge-ui/server.js
//
// Homebridge plug-in for deCONZ.
// Copyright © 2022 Erik Baauw. All rights reserved.

'use strict'

const { HomebridgePluginUiServer } = require('@homebridge/plugin-ui-utils')

// your class MUST extend the HomebridgePluginUiServer
class UiServer extends HomebridgePluginUiServer {
  constructor () {
    console.log('hello, world')
    // super must be called first
    super()

    // Example: create api endpoint request handlers (example only)
    this.onRequest('/hello', async (payload) => {
      console.log('request: /hello %j', payload)
      return { hello: 'world' }
    })

    // this.ready() must be called to let the UI know you are ready to accept api calls
    this.ready()
  }
}

// start the instance of the class
(() => {
  return new UiServer()
})()
