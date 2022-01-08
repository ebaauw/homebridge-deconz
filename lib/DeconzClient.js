// homebridge-deconz/lib/DeconzClient.js
//
// Homebridge plug-in for deCONZ.
// Copyright © 2018-2022 Erik Baauw. All rights reserved.

'use strict'

const events = require('events')
const homebridgeLib = require('homebridge-lib')
const os = require('os')

// API errors that could still cause (part of) the PUT command to be executed.
const nonCriticalApiErrorTypes = [
  6, // parameter not available
  7, // invalid value for parameter
  8, // paramater not modifiable
  201 // paramater not modifiable, device is set to off
]

// Estmate the number of Zigbee messages resulting from PUTting body.
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

/** Deconz API error.
  * @hideconstructor
  * @extends HttpClient.HttpError
  * @memberof DeconzClient
  */
class DeconzError extends homebridgeLib.HttpClient.HttpError {
  constructor (message, response, type, description) {
    super(message, response.request, response.statusCode, response.statusMessage)

    /** @member {integer} - The API error type.
      */
    this.type = type

    /** @member {string} - The API error description.
      */
    this.description = description

    /** @member {boolean} - Indication that the request might still succeed
      * for other attributes.
      */
    this.nonCritical = nonCriticalApiErrorTypes.includes(type)
  }
}

/** Deconz API response.
  * @hideconstructor
  * @extends HttpClient.HttpResponse
  * @memberof DeconzClient
  */
class DeconzResponse extends homebridgeLib.HttpClient.HttpResponse {
  constructor (response) {
    super(
      response.request, response.statusCode, response.statusMessage,
      response.headers, response.body, response.parsedBody
    )

    /** @member {object} - An object with the `"success"` API responses.
      */
    this.success = {}

    /** @member {DeconzClient.DeconzError[]} - A list of `"error"` API responses.
      */
    this.errors = []

    if (Array.isArray(response.body)) {
      for (const id in response.body) {
        const e = response.body[id].error
        if (e != null && typeof e === 'object') {
          this.errors.push(new DeconzError(
            `api error ${e.type}: ${e.description}`,
            response, e.type, e.description
          ))
        }
        const s = response.body[id].success
        if (s != null && typeof s === 'object') {
          for (const path of Object.keys(s)) {
            const a = path.split('/')
            const key = a[a.length - 1]
            this.success[key] = s[path]
          }
        }
      }
    }
  }
}

/** REST API client for deCONZ gateway.
  *
  * See the [deCONZ API](https://dresden-elektronik.github.io/deconz-rest-doc/)
  * documentation for a better understanding of the API.
  * @extends HttpClient
  */
class DeconzClient extends homebridgeLib.HttpClient {
  static get DeconzError () { return DeconzError }
  static get DeconzResponse () { return DeconzResponse }

  static dateToString (date, utc = true) {
    if (date == null || date === 'none') {
      return 'n/a'
    }
    if (utc && !date.endsWith('Z')) {
      date += 'Z'
    }
    return String(new Date(date)).slice(0, 24)
  }

  static parseUniqueid (uniqueid) {
    // TODO sanity check
    const a = uniqueid.replace(/:/g, '').toUpperCase().split('-')
    const o = {
      mac: a[0],
      endpoint: a[1]
    }
    if (a.length > 2) {
      o.cluster = a[2]
    }
    return o
  }

  /** Create a new instance of a DeconzClient.
    *
    * The caller is expected to verify that the given host is a reachable
    * deCONZ gateway, by calling
    * {@link DeconzDiscovery#config DeconzDiscovery#config()} and passing the
    * response as `params.config`.<br>
    * The caller is expected to persist the username (API key),
    * passing it as `params.username`.
    * If no API key is known {@link DeconzClient#createuser createuser()} can
    * be called to create one.<br>
    *
    * @param {object} params - Parameters.
    * @param {?string} params.config - The bridge/gateway public configuration,
    * i.e. the response of {@link DeconzDiscovery#config DeconzDiscovery#config()}.
    * @param {!string} params.host - Hostname/IP address and port of the
    * deCONZ gateway.
    * @param {boolean} [params.keepAlive=false] - Keep server connection(s)
    * open.
    * @param {integer} [params.maxSockets=20] - Throttle requests to maximum
    * number of parallel connections.
    * @param {boolean} [params.phoscon=false] - Mimic Phoscon web app to use
    * deCONZ gateway API extensions.
    * @param {integer} [params.timeout=5] - Request timeout (in seconds).
    * @param {?string} params.username - The API key of the deCONZ gateway.
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
    const optionParser = new homebridgeLib.OptionParser(_options)
    optionParser
      .objectKey('config', true)
      .stringKey('host', true)
      .boolKey('keepAlive')
      .intKey('maxSockets', 1, 20)
      .boolKey('phoscon')
      .intKey('timeout', 1, 60)
      .stringKey('username')
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
      validStatusCodes: [200, 400, 403, 404]
    }
    if (_options.phoscon) {
      // options.headers = { Accept: 'application/vnd.ddel.v1' }
      options.headers = { Accept: 'application/vnd.ddel.v1.1,vnd.ddel.v1.1' }
    }
    if (_options.username) {
      options.path += '/' + _options.username
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

  /** Server (base) path, `/api/`_username_.
    * @type {string}
    * @readonly
    */
  get path () { return super.path }

  /** The API key.
    * @type {string}
    */
  get username () { return this._options.username }
  set username (value) {
    this._options.username = value
    let path = '/api'
    if (value != null) {
      path += '/' + value
    }
    super.path = path
  }

  // ===========================================================================

  /** Issue a GET request of `/api/`_username_`/`_resource_.
    *
    * @param {string} resource - The resource.<br>
    * This might be a resource as exposed by the API, e.g. `/lights/1/state`,
    * or an attribute returned by the API, e.g. `/lights/1/state/on`.
    * @return {*} response - The JSON response body converted to JavaScript.
    * @throws {DeconzError} In case of error.
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

  /** Issue a PUT request to `/api/`_username_`/`_resource_.
    *
    * DeconzClient throttles the number of PUT requests to limit the Zigbee traffic
    * to 20 unicast messsages per seconds, or 1 broadcast message per second,
    * delaying the request when needed.
    * @param {string} resource - The resource.
    * @param {*} body - The body, which will be converted to JSON.
    * @return {DeconzResponse} response - The response.
    * @throws {DeconzError} In case of error, except for non-critical API errors.
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

  /** Issue a POST request to `/api/`_username_`/`_resource_.
    *
    * @param {string} resource - The resource.
    * @param {*} body - The body, which will be converted to JSON.
    * @return {DeconzResponse} response - The response.
    * @throws {DeconzError} In case of error.
    */
  async post (resource, body) {
    return this.request('POST', resource, body)
  }

  /** Issue a DELETE request of `/api/`_username_`/`_resource_.
    * @param {string} resource - The resource.
    * @param {*} body - The body, which will be converted to JSON.
    * @return {DeconzResponse} response - The response.
    * @throws {DeconzError} In case of error.
    */
  async delete (resource, body) {
    return this.request('DELETE', resource, body)
  }

  // ===========================================================================

  /** Create an API key and set {@link DeconzClient#username username}.
    *
    * Calls {@link DeconzClient#post post()} to issue a POST request to `/api`.
    *
    * Before calling `createUser`, the deCONZ gateway must be unlocked, unless
    * the client is running on the same host as the gateway.
    * @return {string} username - The newly created API key.
    * @throws {HttpError} In case of HTTP error.
    * @throws {DeconzError} In case of API error.
    */
  async createUser (application) {
    if (typeof application !== 'string' || application === '') {
      throw new TypeError(`${application}: invalid application name`)
    }
    const username = this._options.username
    const body = { devicetype: `${application}#${os.hostname().split('.')[0]}` }
    this.username = null
    try {
      const response = await this.post('/', body)
      this.username = response.success.username
      return this.username
    } catch (error) {
      this.username = username
      throw (error)
    }
  }

  /** Delete the API key and clear {@link DeconzClient#username username}.
    * @throws {HttpError} In case of HTTP error.
    * @throws {DeconzError} In case of API error.
    */
  async deleteUser () {
    try {
      await this.delete('/config/whitelist/' + this.username)
    } catch (error) {}
    this.username = null
  }

  /** Unlock the gateway to allow creating a new API key.
    *
    * Calls {@link DeconzClient#put put()} to issue a PUT request to
    * `/api/`_username_`/config`.
    *
    * @return {DeconzResponse} response - The response.
    * @throws {HttpError} In case of HTTP error.
    * @throws {DeconzError} In case of API error.
    */
  async unlock () {
    return this.put('/config', { unlock: 60 })
  }

  /** Initiate a touchlink scan.
    *
    * Calls {@link DeconzClient#post post()} to issue a POST request to
    * `/api/`_username_`/touchlink/scan`, to initiate a touchlink scan.
    * As the ConBee II and RaspBee II firmware lack support for touchlink,
    * this will only work for the original ConBee and RaspBee.
    * To see the results of the scan, issue a GET request of
    * `/api/`_username_`/touchlink/scan`.
    * The ID returned in the scan results is needed to touchlink identify or
    * reset the device.
    * To issue a touchlink identify, issue a POST request of
    * `/api/`_username_`/touchlink/`_ID_`/identify`.
    * To issue a touchlink reset, issue a POST request to
    * `/api/`_username_`/touchlink/`_ID_`/reset`.
    * @return {DeconzResponse} response - The response.
    * @throws {HttpError} In case of HTTP error.
    * @throws {DeconzError} In case of API error.
    */
  async touchlink () {
    return this.post('/touchlink/scan')
  }

  /** Search for new devices.
    *
    * Calls {@link DeconzClient#put put()} to issue a PUT request to
    * `/api/`_username_`/config`, to enable pairing of new Zigbee devices.
    *
    * To see the newly paired devices, issue a GET request of
    * `/api/`_username_`/lights/new` and/or `/api/`_username_`/sensor/new`
    * @return {DeconzResponse} response - The response.
    * @throws {HttpError} In case of HTTP error.
    * @throws {DeconzError} In case of API error.
    */
  async search () {
    return this.put('/config', { permitjoin: 120 })
  }

  /** Restart the gateway.
    *
    * Calls {@link DeconzClient#post post()} to issue a POST request to
    * `/api/`_username_`/config/restartapp`, to restart the deCONZ gateway.
    *
    * @return {DeconzResponse} response - The response.
    * @throws {HttpError} In case of HTTP error.
    * @throws {DeconzError} In case of API error.
    */
  async restart () {
    return this.post('/config/restartapp')
  }

  // ===========================================================================

  /** Issue an HTTP request to the deCONZ gateway.
    *
    * This method does the heavy lifting for {@link DeconzClient#get get()},
    * {@link DeconzClient#put put()}, {@link DeconzClient#post post()}, and
    * {@link DeconzClient#delete delete()}.
    * It shouldn't be called directly.
    *
    * @param {string} method - The method for the request.
    * @param {!string} resource - The resource for the request.
    * @param {?*} body - The body for the request.
    * @return {DeconzResponse} response - The response.
    * @throws {HttpError} In case of HTTP error.
    * @throws {DeconzError} In case of API error.
    */
  async request (method, resource, body = null, retry = 0) {
    try {
      const httpResponse = await super.request(method, resource, body)
      const response = new DeconzResponse(httpResponse)
      for (const error of response.errors) {
        /** Emitted for each API error returned by the or deCONZ gateway.
          *
          * @event DeconzClient#error
          * @param {HttpClient.HttpError|HttpClient.DeconzError} error - The error.
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
          await homebridgeLib.timeout(this._options.waitTimeResend)
          return this.request(method, resource, body, retry + 1)
        }
      }
      throw error
    }
  }
}

module.exports = DeconzClient
