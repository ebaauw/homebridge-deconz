// homebridge-deconz/lib/DeconzAccessory/Gateway.js
// Copyright© 2022-2023 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const { AccessoryDelegate, OptionParser, timeout } = require('homebridge-lib')
const { ApiClient, ApiError, WsClient } = require('hb-deconz-tools')
const { HttpError } = ApiClient
const Deconz = require('../Deconz')
const DeconzAccessory = require('../DeconzAccessory')
const DeconzService = require('../DeconzService')

const migration = {
  name: 'homebridge-deconz',
  description: 'migration',
  classid: 1
}

const rtypes = ['lights', 'sensors', 'groups']

const periodicEvents = [
  { rate: 60, event: 1002 },
  { rate: 3600, event: 1004 },
  { rate: 86400, event: 1003 }
]

/** Delegate class for a deCONZ gateway.
  * @extends AccessoryDelegate
  * @memberof DeconzAccessory
  */
class Gateway extends AccessoryDelegate {
  /** Instantiate a gateway delegate.
    * @param {DeconzPlatform} platform - The platform plugin.
    * @param {Object} params - Parameters.
    * @param {Object} params.config - The response body of an unauthenticated
    * GET `/config` (from {@link DeconzDiscovery#config config()}.
    * @param {string} params.host - The gateway hostname or IP address and port.
    */
  constructor (platform, params) {
    super(platform, {
      id: params.config.bridgeid,
      name: params.config.name,
      manufacturer: 'dresden elektronik',
      model: params.config.modelid + ' / ' + params.config.devicename,
      firmware: '0.0.0',
      software: params.config.swversion,
      category: platform.Accessory.Categories.BRIDGE
    })

    this.gateway = this
    this.id = params.config.bridgeid
    this.recommendedSoftware = this.platform.packageJson.engines.deCONZ

    /** Persisted properties.
      * @type {Object}
      * @property {Object} config - Response body of unauthenticated
      * GET `/config` (from {@link DeconzDiscovery#config config()}.
      * @property {Object} fullState - The gateway's full state, from the
      * last time the gateway was polled.
      * @property {Object.<String, Object>} settingsById - The persisted settings, maintained through
      * the Homebridge UI.
      */
    this.context // eslint-disable-line no-unused-expressions
    this.context.config = params.config
    if (this.context.settingsById == null) {
      this.context.settingsById = {}
    }
    if (this.context.fullState != null) {
      this.analyseFullState(this.context.fullState, {
        analyseOnly: true,
        logUnsupported: true
      })
    }

    this.addPropertyDelegate({
      key: 'apiKey',
      silent: true
    }).on('didSet', (value) => {
      this.client.apiKey = value
    })

    this.addPropertyDelegate({
      key: 'autoExpose',
      value: true,
      silent: true
    })

    this.addPropertyDelegate({
      key: 'brightnessAdjustment',
      value: 1,
      silent: true
    })

    this.addPropertyDelegate({
      key: 'expose',
      value: true,
      silent: true
    }).on('didSet', async (value) => {
      try {
        this.service.values.statusActive = value
        if (value) {
          await this.connect()
        } else {
          await this.reset()
        }
      } catch (error) { this.error(error) }
    })

    this.addPropertyDelegate({
      key: 'exposeSchedules',
      value: false,
      silent: true
    }).on('didSet', async (value) => {
      this.pollNext = true
    })

    this.addPropertyDelegate({
      key: 'heartrate',
      value: 30,
      silent: true
    })

    this.addPropertyDelegate({
      key: 'host',
      value: params.host,
      silent: true
    }).on('didSet', (value) => {
      if (this.client != null) {
        this.client.host = value
      }
      if (this.wsClient != null) {
        this.wsClient.host = this.values.host.split(':')[0] +
          ':' + this.values.wsPort
      }
    })

    this.addPropertyDelegate({
      key: 'periodicEvents',
      value: true,
      silent: true
    })

    this.addPropertyDelegate({
      key: 'restart',
      value: false,
      silent: true
    }).on('didSet', async (value) => {
      if (value) {
        try {
          await this.client.restart()
          this.values.search = false
          this.values.unlock = false
          return
        } catch (error) { this.warn(error) }
      }
    })

    this.addPropertyDelegate({
      key: 'search',
      value: false,
      silent: true
    }).on('didSet', async (value) => {
      this.service.values.search = value
      if (value) {
        try {
          await this.client.search()
          await timeout(120000)
          this.values.search = false
          return
        } catch (error) { this.warn(error) }
      }
    })

    this.addPropertyDelegate({
      key: 'unlock',
      value: false,
      silent: true
    }).on('didSet', async (value) => {
      if (value) {
        try {
          await this.client.unlock()
          await timeout(60000)
          this.values.unlock = false
          return
        } catch (error) { this.warn(error) }
      }
    })

    this.addPropertyDelegate({
      key: 'wsPort',
      value: 443,
      silent: true
    }).on('didSet', (value) => {
      if (this.wsClient != null) {
        this.wsClient.host = this.values.host.split(':')[0] +
          ':' + this.values.wsPort
      }
    })

    this.log(
      '%s %s gateway v%s', this.values.manufacturer, this.values.model,
      this.values.software
    )
    if (this.values.software !== this.recommendedSoftware) {
      this.warn('recommended version: deCONZ v%s', this.recommendedSoftware)
    }

    /** Map of Accessory delegates by id for the gateway.
      * @type {Object<string, DeconzAccessory.Device>}
      */
    this.accessoryById = {}

    /** Map of Accessory delegates by rpath for the gateway.
      * @type {Object<string, DeconzAccessory.Device>}
      */
    this.accessoryByRpath = {}

    this.defaultTransitionTime = 0.4

    /** Map of errors by device ID trying to expose the corresponding accessory.
      * @type {Object<string, Error>}
      */
    this.exposeErrorById = {}

    /** The service delegate for the Gateway Settings settings.
      * @type {DeconzService.GatewaySettings}
      */
    this.service = new DeconzService.Gateway(this, {
      name: this.name + ' Gateway',
      primaryService: true,
      host: params.host
    })

    /** The service delegate for the Stateless Programmable Switch service.
      * @type {DeconzService.Button}
      */
    this.buttonService = new DeconzService.Button(this, {
      name: this.name + ' Button',
      button: 1,
      events: DeconzService.Button.SINGLE | DeconzService.Button.DOUBLE |
        DeconzService.Button.LONG
    })

    /** The service delegates for the Schedule services.
      * @type {Object<string, DeconzService.Schedule>}
      */
    this.scheduleServicesByRid = {}

    this.createClient()
    this.createWsClient()
    this.heartbeatEnabled = true
    this
      .on('identify', this.identify)
      .once('heartbeat', (beat) => { this.initialBeat = beat })
      .on('heartbeat', this.heartbeat)
      .on('shutdown', this.shutdown)
  }

  get transitionTime () { return this.service.values.transitionTime }

  async resetTransitionTime () {
    if (this.resetting) {
      return
    }
    this.resetting = true
    await timeout(this.platform.config.waitTimeUpdate)
    this.service.values.transitionTime = this.defaultTransitionTime
    this.resetting = false
  }

  /** Log debug messages.
    */
  identify () {
    this.log(
      '%s %s gateway v%s (%d accessories for %d devices, %d resources)',
      this.values.manufacturer, this.values.model, this.values.software,
      this.nAccessories, this.nDevices, this.nResourcesMonitored
    )
    if (this.values.software !== this.recommendedSoftware) {
      this.warn('recommended version: deCONZ v%s', this.recommendedSoftware)
    }
    if (this.context.migration != null) {
      this.log(
        'migration: %s: %d resources',
        this.context.migration, this.nResourcesMonitored
      )
    }
    if (this.logLevel > 2) {
      this.vdebug(
        '%d gateway resouces: %j', this.nResources,
        Object.keys(this.resourceByRpath).sort()
      )
      this.vdebug(
        '%d gateway devices: %j', this.nDevices,
        Object.keys(this.deviceById).sort()
      )
      this.vdebug(
        '%d accessories: %j', this.nAccessories,
        Object.keys(this.accessoryById).sort()
      )
      this.vdebug(
        'monitoring %d resources: %j', this.nResourcesMonitored,
        Object.keys(this.accessoryByRpath).sort()
      )
      const exposeErrors = Object.keys(this.exposeErrorById).sort()
      this.vdebug(
        '%d accessories with expose errors: %j', exposeErrors.length,
        exposeErrors
      )
      const settings = Object.keys(this.context.settingsById).sort()
      this.vdebug(
        'settings: %d devices: %j', settings.length, settings)
    }
  }

  /** Update properties from gateway announcement.
    * @param {string} host - The gateway hostname or IP address and port.
    * @param {Object} config - The response body of an unauthenticated
    * GET `/config` (from {@link DeconzDiscovery#config config()}.
    */
  async found (host, config) {
    try {
      this.values.host = host
      this.context.config = config
      this.values.software = config.swversion
      if (!this.initialised) {
        this.debug('initialising...')
        await this.connect()
      }
    } catch (error) {
      this.error(error)
    }
  }

  async shutdown () {
    this.service.values.statusActive = false
    return this.wsClient.close()
  }

  /** Called every second.
    * @param {integer} beat
    */
  async heartbeat (beat) {
    beat -= this.initialBeat
    try {
      if (this.values.periodicEvents && beat > 0) {
        for (const { rate, event } of periodicEvents) {
          if (beat % rate === 0) {
            this.buttonService.update(event)
          }
        }
      }
      if (beat - this.pollBeat >= this.values.heartrate || this.pollNext) {
        this.pollBeat = beat
        await this.poll()
      }
    } catch (error) { this.error(error) }
  }

  update (config) {
    this.values.software = config.swversion
    this.values.firmware = parseInt(config.fwversion.slice(6, 8)) + '.' +
      parseInt(config.fwversion.slice(2, 4), 16) + '.' +
      parseInt(config.fwversion.slice(4, 6), 16)
    this.values.wsPort = config.websocketport
    this.service.update(config)
    if (this.checkApiKeys) {
      const myEntry = config.whitelist[this.values.apiKey]
      for (const key in config.whitelist) {
        if (key !== this.values.apiKey) {
          const entry = config.whitelist[key]
          if (entry.name === myEntry.name) {
            this.warn('%s: potentially stale api key: %j', key, entry)
          }
        }
      }
      delete this.checkApiKeys
    }
  }

  /** Create {@link DeconzAccessory.Gateway#client}.
    */
  createClient () {
    /** REST API client for the gateway.
      * @type {DeconzClient}
      */
    this.client = new ApiClient({
      apiKey: this.values.apiKey,
      config: this.context.config,
      host: this.values.host,
      maxSockets: this.platform.config.parallelRequests,
      timeout: this.platform.config.timeout,
      waitTimePut: this.platform.config.waitTimePut,
      waitTimePutGroup: this.platform.config.waitTimePutGroup,
      waitTimeResend: this.platform.config.waitTimeResend
    })
    this.client
      .on('error', (error) => {
        if (error instanceof HttpError) {
          if (error.request.id !== this.requestId) {
            this.log(
              'request %d: %s %s%s', error.request.id,
              error.request.method, error.request.resource,
              error.request.body == null ? '' : ' ' + error.request.body
            )
            this.requestId = error.request.id
          }
          this.warn('request %s: %s', error.request.id, error)
          return
        }
        this.warn(error)
      })
      .on('request', (request) => {
        this.debug(
          'request %d: %s %s%s', request.id,
          request.method, request.resource,
          request.body == null ? '' : ' ' + request.body
        )
        this.vdebug(
          'request %s: %s %s%s', request.id,
          request.method, request.url,
          request.body == null ? '' : ' ' + request.body
        )
      })
      .on('response', (response) => {
        this.vdebug(
          'request %d: response: %j', response.request.id,
          response.body
        )
        this.debug(
          'request %s: %d %s', response.request.id,
          response.statusCode, response.statusMessage
        )
      })
  }

  /** Create {@link DeconzAccessory.Gateway#wsclient}.
    */
  createWsClient () {
    /** Client for gateway web socket notifications.
      * @type {DeconzWsClient}
      */
    this.wsClient = new WsClient({
      host: this.values.host.split(':')[0] + ':' + this.values.wsPort,
      retryTime: 15
    })
    this.wsClient
      .on('error', (error) => {
        this.warn('websocket communication error: %s', error)
      })
      .on('listening', (url) => {
        this.log('websocket connected to %s', url)
      })
      .on('changed', (rtype, rid, body) => {
        try {
          const rpath = '/' + rtype + '/' + rid
          this.vdebug('%s: changed: %j', rpath, body)
          const accessory = this.accessoryByRpath[rpath]
          if (accessory != null) {
            /** Emitted when a change notificatoin for a resource has been
              * received over the web socket.
              * @event DeconzAccessory.Device#changed
              * @param {string} rpath - The resource path.
              * @param {Object} body - The resource body.
              */
            accessory.emit('changed', rpath, body)
          }
        } catch (error) {
          this.warn('websocket error: %s', error)
        }
      })
      .on('added', (rtype, rid, body) => {
        this.vdebug('/%s/%d: added: %j', rtype, rid, body)
        this.pollNext = true
        this.pollFullState = true
      })
      .on('deleted', (rtype, rid) => {
        this.vdebug('/%s/%d: deleted', rtype, rid)
        this.pollNext = true
        this.pollFullState = true
      })
      .on('closed', (url, retryTime) => {
        if (retryTime > 0) {
          this.log(
            'websocket connection to %s closed - retry in %ds', url, retryTime
          )
        } else {
          this.log('websocket connection to %s closed', url)
        }
      })
  }

  /** Connect to the gateway.
    *
    * Try for two minutes to obtain an API key, when no API key is available.
    * When the API key has been obtained, open the web socket, poll the
    * gateway, and analyse the full state.
    */
  async connect (retry = 0) {
    if (!this.values.expose) {
      this.warn('unlock gateway and set expose to obtain an API key')
      return
    }
    try {
      if (this.values.apiKey == null) {
        this.values.apiKey =
          await this.client.getApiKey('homebridge-deconz')
      }
      this.wsClient.listen()
      this.service.values.restart = false
      this.service.values.statusActive = true
      this.checkApiKeys = true
      for (const id in this.exposeErrorById) {
        this.resetExposeError(id)
      }
      this.pollNext = true
      this.pollFullState = true
    } catch (error) {
      if (
        error instanceof ApiError && error.type === 101 && retry < 8
      ) {
        this.log('unlock gateway to obtain API key - retrying in 15s')
        await timeout(15000)
        return this.connect(retry + 1)
      }
      this.error(error)
      this.values.expose = false
    }
  }

  /** Reset the gateway delegate.
    *
    * Delete the API key from the gateway.
    * Close the web socket connection.
    * Delete all accessories and services associated to devices exposed by
    * the gateway.
    */
  async reset () {
    if (this.values.apiKey == null) {
      return
    }
    try {
      try {
        await this.deleteMigration()
        await this.client.deleteApiKey()
      } catch (error) {}
      this.values.apiKey = null
      await this.wsClient.close()
      for (const id in this.accessoryById) {
        if (id !== this.id) {
          this.deleteAccessory(id)
        }
      }
      this.exposeErrors = {}
      this.context.settingsById = {}
      this.context.fullState = null
      this.values.logLevel = 2
    } catch (error) { this.error(error) }
  }

  // ===========================================================================

  /** Blacklist or (re-)expose a gateway device.
    *
    * Delete the associated accessory.  When blacklisted, add the associated
    * device settings delegate to the Gateway accessory, otherwise (re-)add
    * the associated accessory.
    * @params {string} id - The device ID.
    * @params {boolean} expose - Set to `false` to blacklist the device.
    */
  exposeDevice (id, expose) {
    if (id === this.id) {
      throw new RangeError(`${id}: gateway ID`)
    }
    if (this.deviceById[id] == null) {
      throw new RangeError(`${id}: unknown device ID`)
    }
    this.context.settingsById[id].expose = expose
    this.pollNext = true
  }

  /** Re-expose an accessory.
    *
    * Delete the accessory delegate, but keep the HAP accessory, including
    * the persisted context.
    * The delegate will be re-created when the gateway is next polled.
    * @params {string} id - The device ID.
    * @params {boolean} expose - Set to `false` to blacklist the device.
    */
  reExposeAccessory (id) {
    if (id === this.id) {
      throw new RangeError(`${id}: gateway ID`)
    }
    if (this.accessoryById[id] == null) {
      throw new RangeError(`${id}: unknown accessory ID`)
    }
    this.deleteAccessory(id, true)
    this.pollNext = true
  }

  /** Add the accessory for the device.
    * @params {string} id - The device ID.
    * @return {?DeconzAccessory} - The accessory delegate.
    */
  addAccessory (id) {
    if (id === this.id) {
      throw new RangeError(`${id}: gateway ID`)
    }
    if (this.deviceById[id] == null) {
      throw new RangeError(`${id}: unknown device ID`)
    }
    if (this.accessoryById[id] == null) {
      const device = this.deviceById[id]
      delete this.exposeErrorById[id]
      const { body } = device.resource
      this.log('%s: add accessory', body.name)
      let { serviceName } = device.resource
      if (DeconzAccessory[serviceName] == null) {
        // this.warn('%s: %s: not yet supported %s type', body.name, body.type, rtype)
        serviceName = 'Sensor'
      }
      const accessory = new DeconzAccessory[serviceName](this, device)
      this.accessoryById[id] = accessory
      this.monitorResources(accessory, true)
      accessory.once('exposeError', (error) => {
        accessory.warn(error)
        this.exposeErrorById[id] = error
      })
    }
    return this.accessoryById[id]
  }

  /** Delete the accessory delegate and associated HomeKit accessory.
    * @params {string} id - The device ID.
    * @params {boolean} [delegateOnly=false] - Delete the delegate, but keep the
    * associated HomeKit accessory (including context).
    */
  deleteAccessory (id, delegateOnly = false) {
    if (id === this.id) {
      throw new RangeError(`${id}: gateway ID`)
    }
    if (this.accessoryById[id] != null) {
      this.monitorResources(this.accessoryById[id], false)
      this.log(
        '%s: delete accessory%s', this.accessoryById[id].name,
        delegateOnly ? ' delegate' : ''
      )
      this.accessoryById[id].destroy(delegateOnly)
      delete this.accessoryById[id]
      if (this.exposeErrorById[id] != null) {
        delete this.exposeErrorById[id]
      } else if (!delegateOnly) {
        const id = Object.keys(this.exposeErrorById)[0]
        if (id != null) {
          this.log(
            '%s: resetting after expose error: %s', id, this.exposeErrorById[id]
          )
          this.deleteAccessory(id)
        }
      }
    }
  }

  /** Enable / disable accessory events for resource.
    * @param {DeconzAccessory.Device} accessory - The accessory delegate.
    * @param {boolean} monitor - Enable or disable events.
    */
  monitorResources (accessory, monitor = true) {
    const { id, rpaths } = accessory
    for (const rpath of rpaths) {
      if (!monitor) {
        accessory.debug('unsubscribe from %s', rpath)
        delete this.accessoryByRpath[rpath]
      } else if (this.accessoryByRpath[rpath] != null) {
        accessory.warn(new Error('%s: already monitored by', rpath, id))
      } else {
        accessory.debug('subscribe to %s', rpath)
        this.accessoryByRpath[rpath] = accessory
      }
    }
  }

  /** Reset expose error for device.
    *
    * Remove the un-exposed accessory, so it will be re-created on next poll.
    * @params {string} id - The device ID.
    */
  resetExposeError (id) {
    this.log(
      '%s: resetting after expose error: %s', id, this.exposeErrorById[id]
    )
    this.deleteAccessory(id)
  }

  /** Assert that migration resourcelink exists and is valid.
    */
  async checkMigration () {
    if (this.context.migration != null) {
      try {
        const response = await this.client.get(this.context.migration)
        if (
          response.name !== migration.name ||
          response.description !== migration.description ||
          response.classid !== migration.classid ||
          response.owner !== this.client.apiKey
        ) {
          // not my migration resourcelink
          this.warn('%s: migration resourcelink no longer valid', this.context.migration)
          this.context.migration = null
        }
      } catch (error) {
        if (error.statusCode === 404) {
          this.warn('%s: migration resourcelink no longer exists', this.context.migration)
          this.context.migration = null
        }
      }
    }
  }

  /** Create or update migration resourcelink.
    */
  async updateMigration () {
    await this.checkMigration()
    if (this.context.migration == null) {
      const response = await this.client.post('/resourcelinks', {
        name: migration.name,
        description: migration.description,
        classid: migration.classid,
        links: Object.keys(this.accessoryByRpath).sort()
      })
      this.context.migration = '/resourcelinks/' + response.success.id
    } else {
      await this.client.put(this.context.migration, {
        links: Object.keys(this.accessoryByRpath).sort()
      })
    }
  }

  /** Delete migration resourcelink.
    */
  async deleteMigration () {
    await this.checkMigration()
    if (this.context.migration != null) {
      await this.client.delete(this.context.migration)
      this.context.migration = null
    }
  }

  // ===========================================================================

  _deviceToMap (id, details = false) {
    const device = this.deviceById[id]
    if (device == null) {
      return { status: 404 } // Not Found
    }
    const body = {
      expose: details ? undefined : this.accessoryById[device.id] != null,
      id: details ? device.id : undefined,
      manufacturer: device.resource.manufacturer,
      model: device.resource.model,
      name: device.resource.body.name,
      resources: device.rpaths,
      settings: details
        ? {
            expose: this.accessoryById[device.id] != null,
            outlet: undefined, // expose as _Outlet_
            switch: undefined, // expose as _Switch
            valve: undefined // expose as _Valve_
          }
        : undefined,
      type: device.resource.rtype,
      zigbee: device.zigbee
    }
    return { status: 200, body }
  }

  async onUiGet (path) {
    this.debug('ui request: GET %s', path.join('/'))
    if (path.length === 0) {
      const body = {
        host: this.values.host,
        id: this.id,
        manufacturer: this.values.manufacturer,
        model: this.values.model,
        name: this.name,
        settings: this.values.apiKey == null
          ? {
              autoExpose: this.values.autoExpose,
              expose: this.values.expose,
              logLevel: this.values.logLevel
            }
          : {
              autoExpose: this.values.autoExpose,
              brightnessAdjustment: this.values.brightnessAdjustment * 100,
              expose: this.values.expose,
              exposeSchedules: this.values.exposeSchedules,
              heartrate: this.values.heartrate,
              logLevel: this.values.logLevel,
              periodicEvents: this.values.periodicEvents,
              restart: this.values.restart,
              search: this.values.search,
              unlock: this.values.unlock
            }
      }
      return { status: 200, body }
    }
    if (path[0] === 'accessories') {
      if (path.length === 1) {
        const body = {}
        for (const id of Object.keys(this.accessoryById).sort()) {
          body[id] = this.accessoryById[id].onUiGet().body
        }
        return { status: 200, body }
      }
      if (path.length === 2) {
        const id = path[1].replace(/:/g, '').toUpperCase()
        if (this.accessoryById[id] == null) {
          return { status: 404 } // Not Found
        }
        return this.accessoryById[id].onUiGet(true)
      }
    }
    if (path[0] === 'devices') {
      if (path.length === 1) {
        const body = {}
        for (const id of Object.keys(this.deviceById).sort()) {
          body[id] = this._deviceToMap(id).body
        }
        return { status: 200, body }
      }
      if (path.length === 2) {
        return this._deviceToMap(path[1].replace(/:/g, '').toUpperCase(), true)
      }
    }
    return { status: 403 } // Forbidden
  }

  async onUiPut (path, body) {
    this.debug('ui request: PUT %s %j', path.join('/'), body)
    if (path.length === 0) {
      return { status: 405 } // Method Not Allowed
    }
    if (path[0] === 'settings') {
      const settings = {}
      const optionParser = new OptionParser(settings, true)
      optionParser
        .on('userInputError', (error) => {
          this.warn(error)
        })
        .boolKey('autoExpose')
        .boolKey('expose')
        .intKey('logLevel', 0, 3)
      if (this.values.apiKey != null) {
        optionParser
          .intKey('brightnessAdjustment', 10, 100)
          .boolKey('exposeSchedules')
          .intKey('heartrate', 1, 60)
          .boolKey('periodicEvents')
          .boolKey('restart')
          .boolKey('search')
          .boolKey('unlock')
      }
      optionParser.parse(body)

      const responseBody = {}
      for (const key in settings) {
        switch (key) {
          case 'brightnessAdjustment':
            this.values[key] = settings[key] / 100
            responseBody[key] = this.values[key]
            break
          case 'autoExpose':
          case 'expose':
          case 'exposeSchedules':
          case 'heartrate':
          case 'logLevel':
          case 'periodicEvents':
          case 'restart':
          case 'search':
          case 'unlock':
            this.values[key] = settings[key]
            responseBody[key] = this.values[key]
            break
          default:
            break
        }
      }
      return { status: 200, body: responseBody }
    }
    if (path[0] === 'accessories') {
      if (path.length < 3) {
        return { status: 405 } // Method Not Allowed
      }
      if (path.length === 3 && path[2] === 'settings') {
        const id = path[1].replace(/:/g, '').toUpperCase()
        if (this.accessoryById[id] == null) {
          return { status: 404 } // Not Found
        }
        return this.accessoryById[id].onUiPut(body)
      }
    }
    if (path[0] === 'devices') {
      if (path.length < 3) {
        return { status: 405 } // Method Not Allowed
      }
      if (path.length === 3 && path[2] === 'settings') {
        const id = path[1].replace(/:/g, '').toUpperCase()
        if (this.deviceById[id] == null) {
          return { status: 404 } // Not Found
        }
        if (body.expose != null) {
          this.exposeDevice(id, body.expose)
          return { status: 200, body: { expose: body.expose } }
        }
        return { status: 200 }
      }
    }
    return { status: 403 } // Forbidden
  }

  // ===========================================================================

  /** Poll the gateway.
    *
    * Periodically get the gateway full state and call
    * {@link DeconzAccessory.Gateway#analyseFullState()}.<br>
    */
  async poll () {
    if (this.polling || this.values.apiKey == null) {
      return
    }
    try {
      this.polling = true
      this.vdebug('%spolling...', this.pollNext ? 'priority ' : '')
      if (this.context.fullState == null || this.pollFullState) {
        const fullState = await this.client.get('/')
        fullState.groups[0] = await this.client.get('/groups/0')
        this.context.fullState = fullState
        this.pollFullState = false
      } else {
        const config = await this.client.get('/config')
        if (config.bridgeid === this.id && config.UTC == null) {
          this.values.expose = false
          this.values.apiKey = null
          await this.wsClient.close()
          return
        }
        if (config.bridgeid === '0000000000000000' || config.fwversion === '0x00000000') {
          this.warn('deCONZ not ready')
          return
        }
        this.context.fullState.config = config
        this.context.fullState.lights = await this.client.get('/lights')
        this.context.fullState.sensors = await this.client.get('/sensors')
        if (this.nDevicesByRtype.groups > 0) {
          this.context.fullState.groups = await this.client.get('/groups')
          this.context.fullState.groups[0] = await this.client.get('/groups/0')
        }
        if (this.values.exposeSchedules) {
          this.context.fullState.schedules = await this.client.get('/schedules')
        }
      }
      await this.analyseFullState(this.context.fullState)
    } catch (error) {
      this.error(error)
    } finally {
      this.vdebug('polling done')
      this.pollNext = false
      this.polling = false
    }
    if (!this.initialised) {
      this.initialised = true
      this.debug('initialised')
      this.emit('initialised')
    }
  }

  /** Analyse the peristed full state of the gateway,
    * adding, re-configuring, and deleting delegates for corresponding HomeKit
    * accessories and services.
    *
    * The analysis consists of the following steps:
    * 1. Analyse the resources, updating:
    * {@link DeconzAccessory.Gateway#deviceById deviceById},
    * {@link DeconzAccessory.Gateway#deviceByRidByRtype deviceByRidByRtype},
    * {@link DeconzAccessory.Gateway#nDevices nDevices},
    * {@link DeconzAccessory.Gateway#nDevicesByRtype nDevicesByRtype},
    * {@link DeconzAccessory.Gateway#nResources nResources},
    * {@link DeconzAccessory.Gateway#resourceByRpath resourceByRpath}.
    * 2. Analyse (pre-existing) _Device_ accessories, emitting
    * {@link DeconzAccessory.Device#event.polled}, and calling
    * {@link DeconzAccessory.Gateway#deleteAccessory deleteAccessory()} for
    * stale accessories, corresponding to devices that have been deleted from
    * the gateway, blacklisted, or excluded by device primary resource type.
    * 3. Analysing supported devices with enabled device primary resource types,
    * calling {@link DeconzAccessory.Gateway#addAccessory addAccessory()} for new
    * _Device_ accessories, corresponding to devices added to the gateway,
    * un-blacklisted, or included by device primary resource type, and calling
    * {@link DeconzAccessory.Gateway#deleteAccessory deleteAccessory()} for
    * accessories, corresponding to devices have been blacklisted.
    * @param {Object} fullState - The gateway full state, as returned by
    * {@link DeconzAccessory.Gateway#poll poll()}.
    * @param {Object} params - Parameters
    * @param {boolean} [params.logUnsupported=false] - Issue debug
    * messsages for unsupported resources.
    * @param {boolean} [params.analyseOnly=false]
    */
  async analyseFullState (fullState, params = {}) {
    /** Supported devices by device ID.
      *
      * Updated by
      * {@link DeconzAccessory.Gateway#analyseFullState analyseFullState()}.
      * @type {Object<string, Deconz.Device>}
      */
    this.deviceById = {}

    /** Supported resources by resource path.
      *
      * Updated by {@link DeconzAccessory.Gateway#analyseFullState analyseFullState()}.
      * @type {Object<string, Deconz.Resource>}
      */
    this.resourceByRpath = {}

    /** Supported devices by resource ID by resource type, of the primary
      * resource for the device.
      *
      * Updated by
      * {@link DeconzAccessory.Gateway#analyseFullState analyseFullState()}.
      * @type {Object<string, Object<string, Deconz.Device>>}
      */
    this.deviceByRidByRtype = {}

    /** Number of supported devices by resource type.
      *
      * Updated by
      * {@link DeconzAccessory.Gateway#analyseFullState analyseFullState()}.
      * @type {Object<string, integer>}
      */
    this.nDevicesByRtype = {}

    this.vdebug('analysing resources...')
    for (const rtype of rtypes) {
      this.deviceByRidByRtype[rtype] = {}
      for (const rid in fullState[rtype]) {
        try {
          const body = fullState[rtype][rid]
          this.analyseResource(rtype, rid, body, params.logUnsupported)
        } catch (error) { this.error(error) }
      }
    }

    /** Number of supported devices.
      *
      * Updated by
      * {@link DeconzAccessory.Gateway#analyseFullState analyseFullState()}.
      * @type {integer}
      */

    this.nDevices = Object.keys(this.deviceById).length

    /** Number of supported resources.
      *
      * Updated by
      * {@link DeconzAccessory.Gateway#analyseFullState analyseFullState()}.
      * @type {integer}
      */
    this.nResources = Object.keys(this.resourceByRpath).length

    this.vdebug('%d devices, %d resources', this.nDevices, this.nResources)
    for (const id in this.deviceById) {
      const device = this.deviceById[id]
      const { rtype, rid } = device.resource
      this.deviceByRidByRtype[rtype][rid] = device
    }
    for (const rtype of rtypes) {
      this.nDevicesByRtype[rtype] =
        Object.keys(this.deviceByRidByRtype[rtype]).length
      this.vdebug('%d %s devices', this.nDevicesByRtype[rtype], rtype)
    }

    if (params.analyseOnly) {
      return
    }

    this.update(fullState.config)

    let changed = false

    this.vdebug('analysing accessories...')
    for (const id in this.accessoryById) {
      try {
        if (
          this.deviceById[id] == null
        ) {
          delete this.context.settingsById[id]
          this.deleteAccessory(id)
          changed = true
        } else {
          /** Emitted when the gateway has been polled.
            * @event DeconzAccessory.Device#polled
            * @param {Deconz.Device} device - The updated device.
            */
          this.accessoryById[id].emit('polled', this.deviceById[id])
        }
      } catch (error) { this.error(error) }
    }

    for (const rtype of rtypes) {
      this.vdebug('analysing %s devices...', rtype)
      const rids = Object.keys(this.deviceByRidByRtype[rtype]).sort()
      for (const rid of rids) {
        try {
          const { id, resource, zigbee } = this.deviceByRidByRtype[rtype][rid]
          if (this.context.settingsById[id] == null) {
            this.context.settingsById[id] = { expose: zigbee && this.values.autoExpose }
          }
          if (this.context.settingsById[id].expose) {
            if (this.accessoryById[id] == null) {
              const name = resource.body.name
              if (zigbee && resource.body.type !== 'ZGPSwitch') {
                const mac = resource.body.uniqueid.split('-')[0]
                try {
                  const ddf = await this.client.get('/devices/' + mac + '/ddf')
                  if (ddf.status === 'Draft') {
                    this.warn('%s: exposed by legacy code', name)
                  } else if (ddf.status !== 'Gold') {
                    this.warn('%s: exposed by %s ddf', name, ddf.status.toLowerCase())
                  } else {
                    this.debug('%s: exposed by %s ddf', name, ddf.status.toLowerCase())
                  }
                } catch (error) { }
              } else {
                this.debug('%s: exposed by legacy code', name)
              }
              this.addAccessory(id)
              changed = true
            }
          } else {
            if (this.accessoryById[id] != null) {
              this.deleteAccessory(id)
              changed = true
            }
          }
        } catch (error) { this.error(error) }
      }
    }

    this.nAccessories = Object.keys(this.accessoryById).length
    this.nResourcesMonitored = Object.keys(this.accessoryByRpath).length
    this.nExposeErrors = Object.keys(this.exposeErrorById).length
    if (this.nExposeErrors === 0) {
      this.vdebug('%d accessories', this.nAccessories)
    } else {
      this.vdebug(
        '%d accessories, %d expose errors', this.nAccessories, this.nExposeErrors
      )
    }

    this.vdebug('analysing schedules...')
    if (this.values.exposeSchedules) {
      for (const rid in fullState.schedules) {
        if (this.scheduleServicesByRid[rid] == null) {
          this.scheduleServicesByRid[rid] = new DeconzService.Schedule(
            this, rid, fullState.schedules[rid]
          )
        }
        this.scheduleServicesByRid[rid].update(fullState.schedules[rid])
      }
    }
    for (const rid in this.scheduleServicesByRid) {
      if (!this.values.exposeSchedules || fullState.schedules[rid] == null) {
        this.scheduleServicesByRid[rid].destroy()
        delete this.scheduleServicesByRid[rid]
      }
    }

    if (changed) {
      await this.updateMigration()
      this.identify()
    }
  }

  /** Anayse a gateway resource, updating
    * {@link DeconzAccessory.Gateway#deviceById deviceById} and
    * {@link DeconzAccessory.Gateway#resourceByRpath resourceByRpath} for
    * supported resources.
    *
    * @param {string} rtype - The type of the resource:
    * `groups`, `lights`, or `sensors`.
    * @param {integer} rid - The resource ID of the resource.
    * @param {object} body - The body of the resource.
    * @param {boolean} logUnsupported - Issue a debug message for
    * unsupported resources.
    */
  analyseResource (rtype, rid, body, logUnsupported) {
    const resource = new Deconz.Resource(this, rtype, rid, body)
    const { id, serviceName } = resource
    if (id === this.id || serviceName === '') {
      const debug = (logUnsupported ? this.debug : this.vdebug).bind(this)
      debug(
        '%s: /%s/%d: %s: ignoring unsupported %s type',
        id, rtype, rid, body.type, rtype
      )
      return
    }
    if (serviceName == null) {
      const warn = (logUnsupported ? this.warn : this.vdebug).bind(this)
      warn(
        '%s: /%s/%d: %s: ignoring unknown %s type',
        id, rtype, rid, body.type, rtype
      )
      return
    }
    if (this.deviceById[id] == null) {
      this.deviceById[id] = new Deconz.Device(resource)
      this.vdebug('%s: device', id)
    } else {
      this.deviceById[id].addResource(resource)
    }
    const { rpath } = resource
    this.resourceByRpath[rpath] = resource
    this.vdebug('%s: %s: device resource', id, rpath)
  }
}

module.exports = Gateway
