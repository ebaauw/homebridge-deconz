// homebridge-hue/lib/Deconz/Discovery.js
//
// Homebridge plug-in for Philips Hue and/or deCONZ.
// Copyright © 2018-2022 Erik Baauw. All rights reserved.

'use strict'

const events = require('events')
const homebridgeLib = require('homebridge-lib')
const xml2js = require('xml2js')

/** Class for discovery of deCONZ gateways.
  *
  * See the [deCONZ API](https://dresden-elektronik.github.io/deconz-rest-doc/)
  * documentation for a better understanding of the API.
  * @extends EventEmitter
  * @memberof Deconz
  */
class Discovery extends events.EventEmitter {
  /** Create a new instance.
    * @param {object} params - Parameters.
    * @param {boolean} [params.forceHttp=false] - Use plain HTTP instead of HTTPS.
    * @param {integer} [params.timeout=5] - Timeout (in seconds) for requests.
    */
  constructor (params = {}) {
    super()
    this._options = {
      forceHttp: false,
      timeout: 5
    }
    const optionParser = new homebridgeLib.OptionParser(this._options)
    optionParser.boolKey('forceHttp')
    optionParser.intKey('timeout', 1, 60)
    optionParser.parse(params)
  }

  /** Issue an unauthenticated GET request of `/api/config` to given host.
    *
    * @param {string} host - The IP address or hostname and port of the deCONZ
    * gateway.
    * @return {object|null} response - The JSON response body converted to
    * JavaScript, or null when the response doesn't come from deCONZ.
    * @throws {HttpError} In case of error.
    */
  async config (host) {
    const client = new homebridgeLib.HttpClient({
      host,
      json: true,
      path: '/api',
      timeout: this._options.timeout
    })
    client
      .on('error', (error) => {
        /** Emitted when an error has occured.
          *
          * @event DeconzDiscovery#error
          * @param {HttpError} error - The error.
          */
        this.emit('error', error)
      })
      .on('request', (request) => {
        /** Emitted when request has been sent.
          *
          * @event DeconzDiscovery#request
          * @param {HttpRequest} request - The request.
          */
        this.emit('request', request)
      })
      .on('response', (response) => {
        /** Emitted when a valid response has been received.
          *
          * @event DeconzDiscovery#response
          * @param {HttpResponse} response - The response.
          */
        this.emit('response', response)
      })
    const { body } = await client.get('/config')
    if (
      body != null && typeof body === 'object' &&
      typeof body.apiversion === 'string' &&
      /00212E[0-9A-Fa-f]{10}/.test(body.bridgeid) &&
      typeof body.devicename === 'string' &&
      typeof body.name === 'string' &&
      typeof body.swversion === 'string'
    ) {
      return body
    }
    throw new Error('not a deCONZ gateway')
  }

  /** Issue an unauthenticated GET request of `/description.xml` to given host.
    *
    * @param {string} host - The IP address or hostname and port of the deCONZ gateway.
    * @return {object} response - The description, converted to JavaScript.
    * @throws {Error} In case of error.
    */
  async description (host) {
    const options = {
      host,
      timeout: this._options.timeout
    }
    const client = new homebridgeLib.HttpClient(options)
    client
      .on('error', (error) => { this.emit('error', error) })
      .on('request', (request) => { this.emit('request', request) })
      .on('response', (response) => { this.emit('response', response) })
    const { body } = await client.get('/description.xml')
    const xmlOptions = { explicitArray: false }
    const result = await xml2js.parseStringPromise(body, xmlOptions)
    return result
  }

  /** Discover deCONZ gateways.
    *
    * Queries the Phoscon portal for known gateways and does a local search
    * over UPnP.
    * Calls {@link DeconzDiscovery#config config()} for each discovered gateway
    * for verification.
    * @param {boolean} [stealth=false] - Don't query discovery portals.
    * @return {object} response - Response object with a key/value pair per
    * found gateway.  The key is the host (IP address or hostname and port),
    * the value is the return value of {@link DeconzDiscovery#config config()}.
    */
  async discover (stealth = false) {
    this.gatewayMap = {}
    this.jobs = []
    this.jobs.push(this._upnp())
    if (!stealth) {
      this.jobs.push(this._nupnp({
        name: 'phoscon',
        https: !this._options.forceHttp,
        host: 'phoscon.de',
        path: '/discover'
      }))
    }
    for (const job of this.jobs) {
      await job
    }
    return this.gatewayMap
  }

  _found (name, id, host) {
    /** Emitted when a potential gateway has been found.
      * @event DeconzDiscovery#found
      * @param {string} name - The name of the search method.
      * @param {string} bridgeid - The ID of the gateway.
      * @param {string} host - The IP address/hostname and port of the gateway
      * or gateway.
      */
    this.emit('found', name, id, host)
    if (this.gatewayMap[host] == null) {
      this.gatewayMap[host] = id
      this.jobs.push(
        this.config(host).then((config) => {
          this.gatewayMap[host] = config
        }).catch((error) => {
          delete this.gatewayMap[host]
          if (error.request == null) {
            this.emit('error', error)
          }
        })
      )
    }
  }

  async _upnp () {
    const upnpClient = new homebridgeLib.UpnpClient({
      filter: (message) => {
        return /^[0-9A-F]{16}$/.test(message['gwid.phoscon.de'])
      },
      timeout: this._options.timeout
    })
    upnpClient
      .on('error', (error) => { this.emit('error', error) })
      .on('searching', (host) => {
        /** Emitted when UPnP search has started.
          *
          * @event DeconzDiscovery#searching
          * @param {string} host - The IP address and port from which the
          * search was started.
          */
        this.emit('searching', host)
      })
      .on('request', (request) => {
        request.name = 'upnp'
        this.emit('request', request)
      })
      .on('deviceFound', (address, obj, message) => {
        let host
        const a = obj.location.split('/')
        if (a.length > 3 && a[2] != null) {
          host = a[2]
          const b = host.split(':')
          const port = parseInt(b[1])
          if (port === 80) {
            host = b[0]
          }
          this._found('upnp', obj['gwid.phoscon.de'], host)
        }
      })
    upnpClient.search()
    await events.once(upnpClient, 'searchDone')
    /** Emitted when UPnP search has concluded.
      *
      * @event DeconzDiscovery#searchDone
      */
    this.emit('searchDone')
  }

  async _nupnp (options) {
    options.json = true
    options.timeout = this._options.timeout
    const client = new homebridgeLib.HttpClient(options)
    client
      .on('error', (error) => { this.emit('error', error) })
      .on('request', (request) => { this.emit('request', request) })
      .on('response', (response) => { this.emit('response', response) })
    try {
      const { body } = await client.get()
      if (Array.isArray(body)) {
        for (const gateway of body) {
          let host = gateway.internalipaddress
          if (gateway.internalport != null && gateway.internalport !== 80) {
            host += ':' + gateway.internalport
          }
          this._found(options.name, gateway.id.toUpperCase(), host)
        }
      }
    } catch (error) {
      this.emit('error', error)
    }
  }
}

module.exports = Discovery
