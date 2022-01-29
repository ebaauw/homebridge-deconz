// homebridge-deconz/lib/DeconzAccessory/Gateway.js
// Copyright © 2022 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const homebridgeLib = require('homebridge-lib')

const Deconz = require('../Deconz')
const DeconzAccessory = require('../DeconzAccessory')
const DeconzService = require('../DeconzService')

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
class Gateway extends homebridgeLib.AccessoryDelegate {
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

    /** Persisted properties.
      * @type {Object}
      * @property {Object} config - Response body of unauthenticated
      * GET `/config` (from {@link DeconzDiscovery#config config()}.
      * @property {Object.<string, boolean>} blacklist - Map of blacklisted
      * devices.
      * @property {Object} fullState - The gateway's full state, from the
      * last time the gateway was polled.
      */
    this.context // eslint-disable-line no-unused-expressions
    this.context.host = params.host
    this.context.config = params.config
    if (this.context.blacklist == null) {
      this.context.blacklist = {}
    }

    this.addPropertyDelegate({
      key: 'apiKey',
      silent: true
    }).on('didSet', (value) => {
      this.client.apiKey = value
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
    this.values.host = params.host

    this.addPropertyDelegate({
      key: 'rtypes',
      value: [],
      silent: true
    }).on('didSet', async () => {
      this.pollNext = true
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

    /** Map of services to un-blacklist a gateway device.
      * @type {Object<string, DeconzService.DeviceSettings>}
      */
    this.serviceById = {}

    /** The service delegate for the Gateway Settings settings.
      * @type {DeconzService.GatewaySettings}
      */
    this.service = new DeconzService.GatewaySettings(this, {
      name: this.name + ' Gateway Settings',
      primaryService: true,
      host: params.host
    })
    this.manageLogLevel(this.service.characteristicDelegate('logLevel'))

    /** The service delegate for the Stateless Programmable Switch service.
      * @type {DeconzService.Button}
      */
    this.buttonService = new DeconzService.Button(this, {
      name: this.name + ' Button',
      button: 1,
      events: DeconzService.Button.SINGLE | DeconzService.Button.DOUBLE |
        DeconzService.Button.LONG
    })

    this.createClient()
    this.createWsClient()
    this.heartbeatEnabled = true
    this
      .on('identify', this.identify)
      .once('heartbeat', this.init)
      .on('heartbeat', this.heartbeat)
      .on('shutdown', this.shutdown)
  }

  get transitionTime () { return this.service.values.transitionTime }

  async resetTransitionTime () {
    if (this.resetting) {
      return
    }
    this.resetting = true
    await homebridgeLib.timeout(this.platform.config.waitTimeUpdate)
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
      const blacklist = Object.keys(this.context.blacklist).sort()
      this.vdebug(
        'blacklist: %d devices: %j', blacklist.length, blacklist)
    }
  }

  /** Initialise the gateway delegate.
    */
  async init (beat) {
    try {
      this.debug('initialising...')
      this.initialBeat = beat
      if (this.context.fullState != null) {
        this.analyseFullState(this.context.fullState, true)
      }
      await this.connect()
      this.initialised = true
      this.debug('initialised')
      this.emit('initialised')
    } catch (error) { this.error(error) }
  }

  /** Update properties from gateway announcement.
    * @param {string} host - The gateway hostname or IP address and port.
    * @param {Object} config - The response body of an unauthenticated
    * GET `/config` (from {@link DeconzDiscovery#config config()}.
    */
  found (host, config) {
    this.values.host = host
    this.context.config = config
    this.values.software = config.swversion
  }

  async shutdown () {
    return this.wsClient.close()
  }

  /** Called every second.
    * @param {integer} beat
    */
  async heartbeat (beat) {
    beat -= this.initialBeat
    try {
      if (beat > 0) {
        for (const { rate, event } of periodicEvents) {
          if (beat % rate === 0) {
            this.buttonService.update(event)
          }
        }
      }
      if (beat - this.pollBeat >= this.service.values.heartrate || this.pollNext) {
        this.pollBeat = beat
        await this.poll()
      }
    } catch (error) { this.error(error) }
  }

  update (config) {
    this.values.software = config.swversion
    this.values.firmware = config.fwversion
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
    this.client = new Deconz.ApiClient({
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
        if (error instanceof homebridgeLib.HttpClient.HttpError) {
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
    this.wsClient = new Deconz.WsClient({
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
        if (this.service.values[rtype]) {
          this.pollNext = true
        }
      })
      .on('deleted', (rtype, rid) => {
        this.vdebug('/%s/%d: deleted', rtype, rid)
        if (this.service.values[rtype]) {
          this.pollNext = true
        }
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
    if (!this.service.values.expose) {
      this.warn('unlock gateway and set Expose to obtain an API key')
      return
    }
    try {
      if (this.values.apiKey == null) {
        this.values.apiKey =
          await this.client.getApiKey('homebridge-deconz')
      }
      this.wsClient.listen()
      this.checkApiKeys = true
      for (const id in this.exposeErrorById) {
        this.resetExposeError(id)
      }
      this.context.fullState = null
      this.pollNext = true
    } catch (error) {
      if (
        error instanceof Deconz.ApiError && error.type === 101 && retry < 8
      ) {
        this.log('unlock gateway to obtain API key - retrying in 15s')
        await homebridgeLib.timeout(15000)
        return this.connect(retry + 1)
      }
      this.error(error)
      this.service.values.expose = false
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
        await this.client.deleteApiKey()
      } catch (error) {}
      this.values.apiKey = null
      await this.wsClient.close()
      for (const id in this.accessoryById) {
        if (id !== this.id) {
          this.deleteAccessory(id)
        }
      }
      for (const id in this.serviceById) {
        this.deleteService(id)
      }
      this.exposeErrors = {}
      this.context.blacklist = {}
      this.context.fullState = null
      this.service.values.lights = false
      this.service.values.sensors = false
      this.service.values.groups = false
      this.service.values.schedules = false
      this.service.values.logLevel = 2
      this.values.rtypes = []
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
    if (expose) {
      delete this.context.blacklist[id]
    } else {
      this.context.blacklist[id] = true
    }
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

  /** Delete the accessory for the device.
    * @params {string} id - The device ID.
    */
  deleteAccessory (id) {
    if (id === this.id) {
      throw new RangeError(`${id}: gateway ID`)
    }
    if (this.accessoryById[id] != null) {
      this.log('%s: delete accessory', this.accessoryById[id].name)
      this.monitorResources(this.accessoryById[id], false)
      this.accessoryById[id].destroy()
      delete this.accessoryById[id]
      if (this.exposeErrorById[id] == null) {
        const id = Object.keys(this.exposeErrorById)[0]
        if (id != null) {
          this.log(
            '%s: resetting after expose error: %s', id, this.exposeErrorById[id]
          )
          this.deleteAccessory(id)
          this.deleteService(id)
        }
      } else {
        delete this.exposeErrorById[id]
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
    this.deleteService(id)
  }

  /** Add a service to the gateway accessory to un-blacklist a device.
    * @params {string} id - The device ID.
    * @return {DeconzService.DeviceSettings} - The service delegate.
    */
  addService (id) {
    if (id === this.id) {
      throw new RangeError(`${id}: gateway ID`)
    }
    if (this.deviceById[id] == null) {
      throw new RangeError(`${id}: unknown device ID`)
    }
    if (this.serviceById[id] == null) {
      if (Object.keys(this.serviceById).length >= 97) {
        return null
      }
      const { resource, rpaths } = this.deviceById[id]
      const { body } = resource
      const service = new DeconzService.DeviceSettings(this, {
        name: body.name + ' Settings',
        subtype: id,
        resource: rpaths.join(', '),
        expose: this.context.blacklist[id] == null
      })
      this.serviceById[id] = service
    }
    return this.serviceById[id]
  }

  /** Delete the service on the gateway accessory to un-blacklist a device.
    * @params {string} id - The device ID.
    */
  deleteService (id) {
    if (id === this.id) {
      throw new RangeError(`${id}: gateway ID`)
    }
    if (this.serviceById[id] != null) {
      this.serviceById[id].destroy()
      delete this.serviceById[id]
    }
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
      if (this.context.fullState == null) {
        this.context.fullState = await this.client.get('/')
        this.context.fullState.groups[0] = await this.client.get('/groups/0')
      } else {
        const config = await this.client.get('/config')
        if (config.bridgeid === this.id && config.UTC == null) {
          this.service.values.expose = false
          this.values.apiKey = null
          await this.wsClient.close()
          return
        }
        this.context.fullState.config = config
        if (this.service.values.lights || this.service.values.sensors) {
          this.context.fullState.lights = await this.client.get('/lights')
          this.context.fullState.sensors = await this.client.get('/sensors')
        }
        if (this.service.values.groups) {
          this.context.fullState.groups = await this.client.get('/groups')
          this.context.fullState.groups[0] = await this.client.get('/groups/0')
        }
        if (this.service.values.schedules) {
          this.context.fullState.schedules = await this.client.get('/schedules')
        }
      }
      this.analyseFullState(this.context.fullState)
    } catch (error) {
      this.error(error)
    } finally {
      this.vdebug('polling done')
      this.pollNext = false
      this.polling = false
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
    * 3. Analyse (pre-existing) _Device Settings_ services, calling
    * {@link DeconzAccessory.Gateway#deleteService deleteService()}
    * for stale services, corresponding to devices that have been deleted from
    * the gateway, un-blacklisted, or excluded by device primary resource type.
    * 4. Analysing supported devices with enabled device primary resource types,
    * calling {@link DeconzAccessory.Gateway#addAccessory addAccessory()} and
    * {@link DeconzAccessory.Gateway#deleteService deleteService()} for new
    * _Device_ accessories, corresponding to devices added to the gateway,
    * un-blacklisted, or included by device primary resource type, and calling
    * {@link DeconzAccessory.Gateway#addService addService()} and
    * {@link DeconzAccessory.Gateway#deleteAccessory deleteAccessory()} for
    * accessories, corresponding to devices have been blacklisted.
    * @param {Object} fullState - The gateway full state, as returned by
    * {@link DeconzAccessory.Gateway#poll poll()}.
    * @param {boolean} [logUnsupportedResources=false] - Issue debug messsages
    * for unsupported resources.
    */
  analyseFullState (fullState, logUnsupported = false) {
    this.update(fullState.config)

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
          this.analyseResource(rtype, rid, body, logUnsupported)
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

    let changed = false

    this.vdebug('analysing accessories...')
    for (const id in this.accessoryById) {
      try {
        if (
          this.deviceById[id] == null ||
          !this.values.rtypes.includes(this.deviceById[id].resource.rtype)
        ) {
          delete this.context.blacklist[id]
          this.deleteAccessory(id)
          this.deleteService(id)
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

    this.vdebug('analysing services...')
    for (const id in this.serviceById) {
      try {
        if (
          this.deviceById[id] == null ||
          !this.values.rtypes.includes(this.deviceById[id].resource.rtype)
        ) {
          delete this.context.blacklist[id]
          delete this.exposeErrorById[id]
          this.deleteService(id)
          changed = true
        }
      } catch (error) { this.error(error) }
    }

    for (const rtype of this.values.rtypes) {
      this.vdebug('analysing %s devices...', rtype)
      const rids = Object.keys(this.deviceByRidByRtype[rtype]).sort()
      for (const rid of rids) {
        try {
          const { id } = this.deviceByRidByRtype[rtype][rid]
          if (this.context.blacklist[id] == null) {
            if (this.accessoryById[id] == null) {
              this.addAccessory(id)
              changed = true
            }
            if (this.serviceById[id] != null) {
              this.deleteService(id)
              changed = true
            }
          } else {
            if (this.serviceById[id] == null) {
              this.addService(id)
              changed = true
            }
            if (this.accessoryById[id] != null) {
              this.deleteAccessory(id)
              changed = true
            }
          }
        } catch (error) { this.error(error) }
      }
    }

    this.nAccessories = Object.keys(this.accessoryById).length
    this.nExposeErrors = Object.keys(this.exposeErrorById).length
    if (this.nExposeErrors === 0) {
      this.vdebug('%d accessories', this.nAccessories)
    } else {
      this.vdebug(
        '%d accessories, %d expose errors', this.nAccessories, this.nExposeErrors
      )
    }

    if (changed) {
      this.nResourcesMonitored = Object.keys(this.accessoryByRpath).length
      this.identify()
      this.vdebug('updating resourcelink...')
      // TOOD create resourcelink for Homebridge Hue migration
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
    * @param {boolean} logUnsupportedResources - Issue a debug message for
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
