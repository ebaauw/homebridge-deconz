// homebridge-deconz/lib/Deconz/ApiClient.js
//
// Homebridge plug-in for deCONZ.
// Copyright © 2018-2023 Erik Baauw. All rights reserved.

'use strict'

const events = require('events')
const { HttpClient, OptionParser, timeout } = require('homebridge-lib')
const os = require('os')

const Deconz = require('../Deconz')

// Estmate the number of Zigbee messages resulting from PUT body.
function numberOfZigbeeMessages (body = {}) {
  let n = 0
  if (Object.keys(body).includes('on')) {
    n++
  }
  if (
    Object.keys(body).includes('bri') ||
    Object.keys(body).includes('bri_inc')
  ) {
    n++
  }
  if (
    Object.keys(body).includes('xy') ||
    Object.keys(body).includes('ct') ||
    Object.keys(body).includes('hue') ||
    Object.keys(body).includes('sat') ||
    Object.keys(body).includes('effect')
  ) {
    n++
  }
  return n === 0 ? 1 : n
}

/** REST API client for a deCONZ gateway.
  *
  * See the [deCONZ API](https://dresden-elektronik.github.io/deconz-rest-doc/)
  * documentation for a better understanding of the API.
  * @extends HttpClient
  * @memberof Deconz
  */
class ApiClient extends HttpClient {
  /** Events reported through `buttonevent`.
    * @type {Object<string, integer>}
    */
  static get buttonEvent () {
    return {
      PRESS: 0,
      HOLD: 1,
      SHORT_RELEASE: 2,
      LONG_RELEASE: 3,
      DOUBLE_PRESS: 4,
      TRIPLE_PRESS: 5,
      QUADRUPLE_PRESS: 6,
      SHAKE: 7,
      DROP: 8,
      TILT: 9
    }
  }

  /** Convert date as reported by deCONZ to human readable string.
    * @param {string} date - The ISO-8601 date string.
    * @param {boolean} [utc=true] - Treat date as UTC, even with missing `Z`.
    * @param {string} date - The human readable date string.
    */
  static dateToString (date, utc = true) {
    if (date == null || date === 'none') {
      return 'n/a'
    }
    if (utc && !date.endsWith('Z')) {
      date += 'Z'
    }
    return String(new Date(date)).slice(0, 24)
  }

  /** Convert `lightlevel` to lux.
    * @param {integer} lightLevel - The `lightlevel` as reported by deCONZ.
    * @return {integer} lux - The value in lux.
    */
  static lightLevelToLux (v) {
    v = Math.max(0, Math.min(v, 60001))
    return v ? Math.round(Math.pow(10, (v - 1) / 10000) * 10) / 10 : 0.0001
  }

  /** Create a new instance of a Deconz.ApiClient.
    *
    * The caller is expected to verify that the given host is a reachable
    * deCONZ gateway, by calling
    * {@link Deconz.Discovery#config Deconz.Discovery#config()} and passing the
    * response as `params.config`.<br>
    * The caller is expected to persist the API key, passing it as
    * `params.apiKey`.
    * If no API key is known {@link Deconz.ApiClient#getApiKey getApiKey()} can
    * be called to create one.<br>
    *
    * @param {object} params - Parameters.
    * @param {?string} params.config - The bridge/gateway public configuration,
    * i.e. the response of {@link Deconz.Discovery#config config()}.
    * @param {!string} params.host - Hostname/IP address and port of the
    * deCONZ gateway.
    * @param {boolean} [params.keepAlive=false] - Keep server connection(s)
    * open.
    * @param {integer} [params.maxSockets=20] - Throttle requests to maximum
    * number of parallel connections.
    * @param {boolean} [params.phoscon=false] - Mimic Phoscon web app to use
    * deCONZ gateway API extensions.
    * @param {integer} [params.timeout=5] - Request timeout (in seconds).
    * @param {?string} params.apiKey - The API key of the deCONZ gateway.
    * @param {integer} [params.waitTimePut=50] - The time (in milliseconds),
    * after sending a PUT request, to wait before sending another PUT request.
    * @param {integer} [params.waitTimePutGroup=1000] - The time (in
    * milliseconds), after sending a PUT request, to wait before sending
    * another PUT request.
    * @param {integer} [params.waitTimeResend=300] - The time, in milliseconds,
    * to wait before resending a request after an ECONNRESET, an http status
    * 503, or an api 901 error.
    */
  constructor (params = {}) {
    const _options = {
      keepAlive: false,
      maxSockets: 20,
      timeout: 5,
      waitTimePut: 50,
      waitTimePutGroup: 1000,
      waitTimeResend: 300
    }
    const optionParser = new OptionParser(_options)
    optionParser
      .objectKey('config', true)
      .stringKey('host', true)
      .boolKey('keepAlive')
      .intKey('maxSockets', 1, 20)
      .boolKey('phoscon')
      .intKey('timeout', 1, 60)
      .stringKey('apiKey')
      .intKey('waitTimePut', 0, 50)
      .intKey('waitTimePutGroup', 0, 1000)
      .intKey('waitTimeResend', 0, 1000)
      .parse(params)

    const options = {
      host: _options.host,
      json: true,
      keepAlive: _options.keepAlive,
      maxSockets: _options.maxSockets,
      path: '/api',
      timeout: _options.timeout,
      validStatusCodes: [200, 400, 403] //, 404]
    }
    if (_options.phoscon) {
      // options.headers = { Accept: 'application/vnd.ddel.v1' }
      options.headers = { Accept: 'application/vnd.ddel.v3,application/vnd.ddel.v2,application/vnd.ddel.v1.1' }
    }
    if (_options.apiKey) {
      options.path += '/' + _options.apiKey
    }
    super(options)
    this._options = _options
    this.waitForIt = false
    this.setMaxListeners(30)
  }

  /** The ID (Zigbee mac address) of the deCONZ gateway.
    * @type {string}
    * @readonly
    */
  get bridgeid () { return this._options.config.bridgeid }

  /** Server (base) path, `/api/`_API_key_.
    * @type {string}
    * @readonly
    */
  get path () { return super.path }

  /** The API key.
    * @type {string}
    */
  get apiKey () { return this._options.apiKey }
  set apiKey (value) {
    this._options.apiKey = value
    let path = '/api'
    if (value != null) {
      path += '/' + value
    }
    super.path = path
  }

  // ===========================================================================

  /** Issue a GET request of `/api/`_API_key_`/`_resource_.
    *
    * @param {string} resource - The resource.<br>
    * This might be a resource as exposed by the API, e.g. `/lights/1/state`,
    * or an attribute returned by the API, e.g. `/lights/1/state/on`.
    * @return {*} response - The JSON response body converted to JavaScript.
    * @throws {Deconz.ApiError} In case of error.
    */
  async get (resource) {
    if (typeof resource !== 'string' || resource[0] !== '/') {
      throw new TypeError(`${resource}: invalid resource`)
    }
    let path = resource.slice(1).split('/')
    switch (path[0]) {
      case 'lights':
        if (path.length === 3 && path[2] === 'connectivity2') {
          path = []
          break
        }
        // falls through
      case 'groups':
        if (path.length >= 3 && path[2] === 'scenes') {
          resource = '/' + path.shift() + '/' + path.shift() + '/' + path.shift()
          if (path.length >= 1) {
            resource += '/' + path.shift()
          }
          break
        }
        // falls through
      case 'schedules':
      case 'sensors':
      case 'rules':
      case 'resourcelinks':
        if (path.length > 2) {
          resource = '/' + path.shift() + '/' + path.shift()
          break
        }
        path = []
        break
      case 'config':
      case 'capabilities':
        if (path.length > 1) {
          resource = '/' + path.shift()
          break
        }
        // falls through
      default:
        path = []
        break
    }
    let { body } = await this.request('GET', resource)
    for (const key of path) {
      if (typeof body === 'object' && body != null) {
        body = body[key]
      }
    }
    if (body == null && path.length > 0) {
      throw new Error(
        `/${path.join('/')}: not found in resource ${resource}`
      )
    }
    return body
  }

  /** Issue a PUT request to `/api/`_API_key_`/`_resource_.
    *
    * ApiClient throttles the number of PUT requests to limit the Zigbee traffic
    * to 20 unicast messsages per seconds, or 1 broadcast message per second,
    * delaying the request when needed.
    * @param {string} resource - The resource.
    * @param {*} body - The body, which will be converted to JSON.
    * @return {Deconz.ApiResponse} response - The response.
    * @throws {Deconz.ApiError} In case of error, except for non-critical API errors.
    */
  async put (resource, body) {
    if (this.waitForIt) {
      while (this.waitForIt) {
        try {
          await events.once(this, '_go')
        } catch (error) {}
      }
    }
    const timeout = numberOfZigbeeMessages(body) * (
      resource.startsWith('/groups')
        ? this._options.waitTimePutGroup
        : this._options.waitTimePut
    )
    if (timeout > 0) {
      this.waitForIt = true
      setTimeout(() => {
        this.waitForIt = false
        this.emit('_go')
      }, timeout)
    }
    return this.request('PUT', resource, body)
  }

  /** Issue a POST request to `/api/`_API_key_`/`_resource_.
    *
    * @param {string} resource - The resource.
    * @param {*} body - The body, which will be converted to JSON.
    * @return {Deconz.ApiResponse} response - The response.
    * @throws {Deconz.ApiError} In case of error.
    */
  async post (resource, body) {
    return this.request('POST', resource, body)
  }

  /** Issue a DELETE request of `/api/`_API_key_`/`_resource_.
    * @param {string} resource - The resource.
    * @param {*} body - The body, which will be converted to JSON.
    * @return {Deconz.ApiResponse} response - The response.
    * @throws {Deconz.ApiError} In case of error.
    */
  async delete (resource, body) {
    return this.request('DELETE', resource, body)
  }

  // ===========================================================================

  /** Obtain an API key and set {@link Deconz.ApiClient#apiKey apiKey}.
    *
    * Calls {@link Deconz.ApiClient#post post()} to issue a POST request to `/api`.
    *
    * Before calling `getApiKey`, the deCONZ gateway must be unlocked, unless
    * the client is running on the same host as the gateway.
    * @return {string} apiKey - The newly created API key.
    * @throws {HttpError} In case of HTTP error.
    * @throws {Deconz.ApiError} In case of API error.
    */
  async getApiKey (application) {
    if (typeof application !== 'string' || application === '') {
      throw new TypeError(`${application}: invalid application name`)
    }
    const apiKey = this._options.apiKey
    const body = { devicetype: `${application}#${os.hostname().split('.')[0]}` }
    this.apiKey = null
    try {
      const response = await this.post('/', body)
      this.apiKey = response.success.username
      return this.apiKey
    } catch (error) {
      this.apiKey = apiKey
      throw (error)
    }
  }

  /** Delete the API key and clear {@link Deconz.ApiClient#apiKey apiKey}.
    * @throws {HttpError} In case of HTTP error.
    * @throws {Deconz.ApiError} In case of API error.
    */
  async deleteApiKey () {
    try {
      await this.delete('/config/whitelist/' + this.apiKey)
    } catch (error) {}
    this.apiKey = null
  }

  /** Unlock the gateway to allow creating a new API key.
    *
    * Calls {@link Deconz.ApiClient#put put()} to issue a PUT request to
    * `/api/`_API_key_`/config`.
    *
    * @return {Deconz.ApiResponse} response - The response.
    * @throws {HttpError} In case of HTTP error.
    * @throws {Deconz.ApiError} In case of API error.
    */
  async unlock () {
    return this.put('/config', { unlock: 60 })
  }

  /** Search for new devices.
    *
    * Calls {@link Deconz.ApiClient#put put()} to issue a PUT request to
    * `/api/`_API_key_`/config`, to enable pairing of new Zigbee devices.
    *
    * To see the newly paired devices, issue a GET request of
    * `/api/`_API_key_`/lights/new` and/or `/api/`_API_key_`/sensor/new`
    * @return {Deconz.ApiResponse} response - The response.
    * @throws {HttpError} In case of HTTP error.
    * @throws {Deconz.ApiError} In case of API error.
    */
  async search () {
    return this.put('/config', { permitjoin: 120 })
  }

  /** Restart the gateway.
    *
    * Calls {@link Deconz.ApiClient#post post()} to issue a POST request to
    * `/api/`_API_key_`/config/restartapp`, to restart the deCONZ gateway.
    *
    * @return {Deconz.ApiResponse} response - The response.
    * @throws {HttpError} In case of HTTP error.
    * @throws {Deconz.ApiError} In case of API error.
    */
  async restart () {
    return this.post('/config/restartapp')
  }

  // ===========================================================================

  /** Issue an HTTP request to the deCONZ gateway.
    *
    * This method does the heavy lifting for {@link Deconz.AplClient#get get()},
    * {@link Deconz.ApiClient#put put()}, {@link Deconz.ApiClient#post post()},
    * and {@link Deconz.ApiClient#delete delete()}.
    * It shouldn't be called directly.
    *
    * @param {string} method - The method for the request.
    * @param {!string} resource - The resource for the request.
    * @param {?*} body - The body for the request.
    * @return {Deconz.ApiResponse} response - The response.
    * @throws {HttpError} In case of HTTP error.
    * @throws {Deconz.ApiError} In case of API error.
    */
  async request (method, resource, body = null, retry = 0) {
    try {
      const httpResponse = await super.request(method, resource, body)
      const response = new Deconz.ApiResponse(httpResponse)
      for (const error of response.errors) {
        /** Emitted for each API error returned by the or deCONZ gateway.
          *
          * @event Deconz.ApiClient#error
          * @param {HttpClient.HttpError|Deconz.ApiError} error - The error.
          */
        this.emit('error', error)
        if (!error.nonCritical) {
          throw error
        }
      }
      return response
    } catch (error) {
      if (
        error.code === 'ECONNRESET' ||
        error.statusCode === 503 ||
        error.type === 901
      ) {
        if (error.request != null && this._options.waitTimeResend > 0 && retry < 5) {
          error.message += ' - retry in ' + this._options.waitTimeResend + 'ms'
          this.emit('error', error)
          await timeout(this._options.waitTimeResend)
          return this.request(method, resource, body, retry + 1)
        }
      }
      throw error
    }
  }
}

module.exports = ApiClient
