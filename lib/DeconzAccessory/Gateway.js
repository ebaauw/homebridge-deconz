// homebridge-deconz/lib/DeconzAccessory/Gateway.js
// Copyright © 2022 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const homebridgeLib = require('homebridge-lib')

const DeconzClient = require('../DeconzClient')
const DeconzWsClient = require('../DeconzWsClient')
const DeconzAccessory = require('../DeconzAccessory')
const DeconzService = require('../DeconzService')

const { toInt, toObject, toString } = homebridgeLib.OptionParser
const { parseUniqueid } = DeconzClient

const rtypes = ['groups', 'lights', 'sensors']

/** Delegate class for a deCONZ gateway.
  * @class
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
      category: platform.Accessory.Categories.Bridge
    })

    this.gateway = this
    this.id = params.config.bridgeid

    /** Persisted properties.
      * @type {Object}
      * @property {Object} config - Response body of unauthenticated
      * GET `/config` (from {@link DeconzDiscovery#config config()}.
      * @property {Object.<string, boolean>} blacklist - Map of device IDs
      * of blacklisted devices, with value `true`.
      * @property {Object} fullState - The gateway's full state,
      * the response body of a GET `/`.
      * @property {string} host - Gateway hostname or IP address and port.
      */
    this.context // eslint-disable-line no-unused-expressions

    this.context.host = params.host
    this.context.config = params.config
    if (this.context.blacklist == null) {
      this.context.blacklist = {}
    }

    this.log(
      '%s %s gateway v%s', this.values.manufacturer, this.values.model,
      this.values.software
    )

    /** Map of Accessory delegates by id for the gayeway.
      * @type {Object<string, DeconzAccessory.Device>}
      */
    this.accessoryById = {}

    /** Map of Accessory delegates by rpath for the gayeway.
      * @type {Object<string, DeconzAccessory.Device>}
      */
    this.accessoryByRpath = {}

    /** Map of services to un-blacklist a gateway device.
      * @type {Object<string, DeconzService.DeviceSettings>}
      */
    this.serviceById = {}

    /** The service delegate for the Gateway Settings settings.
      * @type {DeconzService.GatewaySettings}
      */
    this.service = new DeconzService.GatewaySettings(this, {
      primaryService: true,
      host: params.host
    })
    /** The service delegate for the Stateless Programmable Switch service.
      * @type {DeconzService.Button}
      */
    this.buttonService = new DeconzService.Button(this, {
      name: this.name,
      button: 1,
      events: DeconzService.Button.SINGLE
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

  /** List of IDs of devices currently exposed as accessory.
    * @type {string[]}
    */
  get accessoryIds () { return Object.keys(this.accessoryById).sort() }

  /** List of resource paths of gateway resources currently monitored.
    * @type {string[]}
    */
  get resourcePaths () { return Object.keys(this.accessoryByRpath).sort() }

  /** List of IDs of blacklisted devices.
    * @type {string[]}
    */
  get blacklist () { return Object.keys(this.context.blacklist).sort() }

  /** Log debug messages.
    */
  identify () {
    this.log(
      '%s %s gateway v%s (%d accessories)', this.values.manufacturer, this.values.model,
      this.values.software, this.accessoryIds.length
    )
    this.debug(
      '%d resouces: %j', this.resources.length, this.resources
    )
    this.debug(
      '%d devices: %j', this.deviceIds.length, this.deviceIds
    )
    this.debug(
      'exposing %d accessories: %j', this.accessoryIds.length, this.accessoryIds
    )
    this.debug(
      'monitoring %d resources: %j', this.resourcePaths.length, this.resourcePaths
    )
    this.debug(
      'blacklist: %d devices: %j', this.blacklist.length, this.blacklist
    )
  }

  /** Initialise the gateway delegate.
    */
  async init () {
    try {
      this.debug('initialising...')
      if (this.context.fullState != null) {
        // Rebuild deviceMap and resourceMap from cached bridge state,
        // re-exposing all accessories and services.
        this.analyseFullState()
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
    this.service.values.host = host
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
    try {
      if (
        beat % this.service.values.heartrate === 0 &&
        this.service.values.username != null
      ) {
        await this.poll()
      }
    } catch (error) { this.error(error) }
  }

  /** Create {@link DeconzAccessory.Gateway#client}.
    */
  createClient () {
    /** REST API client for the gateway.
      * @type {DeconzClient}
      */
    this.client = new DeconzClient({
      host: this.service.values.host,
      config: this.context.config,
      username: this.service.values.username
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
    this.wsClient = new DeconzWsClient({
      host: this.service.values.wsHost,
      retryTime: 15
    })
    this.wsClient
      .on('error', (error) => {
        this.warn('websocket communication error: %s', error)
      })
      .on('listening', (url) => {
        this.log('websocket connected to %s', url)
      })
      .on('changed', (rpath, obj) => {
        this.vdebug('%s: event: %j', rpath, obj)
        try {
          const a = rpath.split('/')
          rpath = a.slice(0, 3).join('/')
          const accessory = this.accessoryByRpath[rpath]
          if (accessory != null) {
            let body = obj
            if (a[3] != null) {
              body = {}
              body[a[3]] = obj
            }
            /** Emitted when resource has been polled.
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
      this.warn('unlock gayeway and set Expose to obtain an API key')
      return
    }
    try {
      if (this.service.values.username == null) {
        this.service.values.username =
          await this.client.createUser('homebridge-deconz')
      }
      this.wsClient.listen()
      await this.poll()
      return
    } catch (error) {
      if (
        error instanceof DeconzClient.DeconzError && error.type === 101 &&
        retry < 8
      ) {
        this.log('unlock gateway to obtain API key - retrying in 15s')
        await homebridgeLib.timeout(15000)
        return this.connect(retry + 1)
      }
    }
    this.service.values.expose = false
  }

  /** Reset the gateway delegate.
    *
    * Delete the API key from the gateway.
    * Close the web socket connection.
    * Delete all accessories and services associated to devices exposed by
    * the gateway.
    */
  async reset () {
    if (this.service.values.username == null) {
      return
    }
    try {
      try {
        await this.client.deleteUser()
      } catch (error) {}
      this.service.values.username = null
      await this.wsClient.close()
      for (const id in this.accessoryById) {
        if (id !== this.id) {
          this.deleteAccessory(id)
        }
      }
      for (const id in this.serviceById) {
        this.deleteService(id)
      }
      this.context.blacklist = {}
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
    if (this.deviceMap[id] == null) {
      throw new RangeError(`${id}: unknown device ID`)
    }
    this.deleteAccessory(id)
    if (expose) {
      this.deleteService(id) // ???
      this.addAccessory(id)
      delete this.context.blacklist[id]
    } else {
      this.context.blacklist[id] = true
      this.deleteAccessory(id)
      this.addService(id) // ???
    }
  }

  /** Add the accessory for the device.
    * @params {string} id - The device ID.
    * @return {DeconzAccessory} - The accessory delegate.
    */
  addAccessory (id) {
    if (id === this.id) {
      throw new RangeError(`${id}: gateway ID`)
    }
    if (this.deviceMap[id] == null) {
      throw new RangeError(`${id}: unknown device ID`)
    }
    if (this.accessoryById[id] == null) {
      const device = this.deviceMap[id]
      this.debug(
        '%s: new device, %d resources', id, Object.keys(device.resourceMap).length
      )
      const { body, category, rpath } = device.resourceMap[device.primary]
      if (device.zigbee) {
        this.accessoryById[id] = new DeconzAccessory.Device(this, {
          id: id,
          name: body.name,
          manufacturer: body.manufacturername,
          model: body.modelid,
          firmware: body.swversion == null ? '0.0.0' : body.swversion,
          category: category,
          device: device
        })
      } else {
        this.accessoryById[id] = new DeconzAccessory.Device(this, {
          id: id,
          name: body.name,
          manufacturer: 'dresden elektronik',
          model: body.type,
          firmware: this.values.software,
          category: category,
          device: device
        })
      }
      this.debug('%s-%s: %s: %j', id, device.primary, rpath, body)
      for (const subtype in device.resourceMap) {
        const { rpath } = device.resourceMap[subtype]
        if (subtype !== device.primary) {
          this.debug('%s-%s: %s: %j', id, subtype, rpath, body)
        }
        this.accessoryByRpath[rpath] = this.accessoryById[id]
      }
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
      this.accessoryById[id].destroy()
      delete this.accessoryById[id]
    }
  }

  /** Add a service to the gateway accessory to un-blacklist the device.
    * @params {string} id - The device ID.
    * @return {DeconzService.DeviceSettings} - The service delegate.
    */
  addService (id) {
    if (id === this.id) {
      throw new RangeError(`${id}: gateway ID`)
    }
    if (this.deviceMap[id] == null) {
      throw new RangeError(`${id}: unknown device ID`)
    }
    if (this.serviceById[id] == null) {
      const { primary, resourceMap } = this.deviceMap[id]
      const { body, rpath } = resourceMap[primary]
      this.serviceById[id] = new DeconzService.DeviceSettings(this, {
        name: body.name,
        subtype: id,
        resource: rpath,
        expose: this.context.blacklist[id] == null
      })
    }
    return this.serviceById[id]
  }

  /** Delete the service on the gateway accessory to un-blacklist the device.
    * @params {string} id - The device ID.
    */
  deleteService (id) {
    if (id === this.id) {
      return
    }
    if (this.serviceById[id] != null) {
      this.serviceById[id].destroy()
      delete this.serviceById[id]
    }
  }

  // ===========================================================================

  /** List of IDs of all devices.
    * @type {string[]}
    */
  get deviceIds () { return Object.keys(this.deviceMap || {}).sort() }

  /** List of resource paths of all resources.
    * @type {string[]}
    */
  get resources () { return Object.keys(this.resourceMap || {}).sort() }

  /** Poll the gateway.
    *
    * Periodically read and analyse the gateway full state.<br>
    * The `/groups`, `/lights`, and `/sensors` resources are analysed to build
    * a map of zigbee and virtual devices exposed by the gateway, while:
    * - Creating new accessories for new devices;
    * - Updating existing accessories for existing devices;
    * - Deleting existing accessories for deleted devices.
    */
  async poll () {
    if (this.polling || this.service.values.username == null) {
      return
    }
    this.polling = true
    try {
      this.context.fullState = await this.client.get('/')
      this.values.software = this.context.fullState.config.swversion
      this.values.firmware = this.context.fullState.config.fwversion
      this.service.update(this.context.fullState.config)
      this.buttonService.update(1002)
      this.context.fullState.groups[0] = await this.client.get('/groups/0')
      this.analyseFullState()
    } catch (error) {
      this.error(error)
    }
    this.polling = false
  }

  analyseFullState () {
    this.debug('analysing full state, ')
    /** Devices by device ID.
      * @type {Object<string, DeconzAccessory.Gateway.Device>}
      */
    this.deviceMap = {}
    /** Resources by resource path.
      * @type {Object<string, DeconzAccessory.Gateway.Device.Resource>}
      */
    this.resourceMap = {}
    for (const rtype of rtypes) {
      for (const rid in this.context.fullState[rtype]) {
        const body = this.context.fullState[rtype][rid]
        const { rpath } = this.analyseResource(rtype, rid, body)
        const accessory = this.accessoryByRpath[rpath]
        if (accessory != null) {
          /** Emitted when resource has been polled.
            * @event DeconzAccessory.Device#polled
            * @param {string} rpath - The resource path.
            * @param {Object} body - The resource body.
            */
          accessory.emit('polled', rpath, body)
        }
      }
    }
    let changed = false
    for (const id of this.accessoryIds) {
      if (this.deviceMap[id] == null) {
        try {
          this.deleteAccessory(id)
          changed = true
        } catch (error) { this.warn(error) }
      }
    }
    for (const id of this.blacklist) {
      if (this.deviceMap[id] == null) {
        try {
          this.deleteService(id)
          changed = true
        } catch (error) { this.warn(error) }
      }
    }
    for (const id of this.deviceIds) {
      if (this.context.blacklist[id] == null) {
        if (this.accessoryById[id] == null) {
          try {
            this.addAccessory(id)
            changed = true
          } catch (error) { this.warn(error) }
        }
      } else { // ???
        if (this.serviceById[id] == null) {
          try {
            this.addService(id)
            changed = true
          } catch (error) { this.warn(error) }
        }
      } // ???
    }
    if (changed) {
      this.identify()
    }
  }

  static get Device () { return Device }
  static get ResourceAttributes () { return ResourceAttributes }
  static get TypeAttributes () { return TypeAttributes }

  /** Anayse a resource, updating
    * {@link DeconzAccessory.Gateway#deviceMap deviceMap} and
    * {@link DeconzAccessory.Gateway#resourceMap resourceMap} and
    *
    * @param {string} rtype - The type of the resource:
    * `group`, `light`, or `sensor`.
    * @param {integer} rid - The resource ID of the resource.
    * @param {object} body - The body of the resource.
    * @return {DeconzAccessory.Gateway.Device.Resource} - The resource.
    */
  analyseResource (rtype, rid, body) {
    const attrs = this.resourceAttrs(rtype, rid, body)
    const { id } = attrs
    if (id === this.id) {
      return { rpath: '/config' }
    }
    if (this.deviceMap[id] == null) {
      this.deviceMap[id] = new Device(rtype, rid, body, attrs)
      this.vdebug('%s: device', id)
    }
    const resource = this.deviceMap[id].addResource(rtype, rid, body, attrs)
    const { rpath } = resource
    this.vdebug('%s: %s: device resource', id, rpath)
    this.resourceMap[rpath] = resource
    return resource
  }

  /** Derive the attributes for a resource.
    *
    * @param {string} rtype - The type of the resource:
    * `config`, `group`, `light`, or `sensor`.
    * @param {integer} rid - The resource ID of the resource.
    * @param {object} body - The body of the resource.
    * @returns {DeconzAccessory.Gateway.ResourceAttributes} - The derived
    * resource attributes.
    */
  resourceAttrs (rtype, rid, body) {
    toString('params.rtype', rtype, true)
    if (!(rtypes.includes(rtype))) {
      throw new RangeError(`rtype: ${rtype}: not a valid resource type`)
    }
    toInt('rid', rid)
    toObject('body', body)
    toString('body.name', body.name, true)
    toString('body.type', body.type, true)
    if (rtype === 'lights' || (rtype === 'sensors' && body.type.startsWith('Z'))) {
      const { mac, endpoint, cluster } = parseUniqueid(body.uniqueid)
      return new ResourceAttributes(
        mac,
        endpoint + (cluster == null ? '' : '-' + cluster),
        rtype === 'lights'
          ? this.lightTypeAttributes(body.type)
          : this.sensorTypeAttributes(body.type),
        true
      )
    }
    if (rtype === 'groups') {
      return new ResourceAttributes(
        this.id + '-G' + rid,
        'G' + rid,
        new TypeAttributes(this.Accessory.Categories.LIGHTBULB, 'LightBulb'),
        false
      )
    }
    return new ResourceAttributes(
      this.id + '-S' + rid,
      'S' + rid,
      this.sensorTypeAttributes(body.type),
      false
    )
  }

  /** Derive the attributes for a `/lights` resource type.
    *
    * @params {string} type - The `type` attribute of the `/lights` resource.
    * @return {DeconzAccessory.Gateway.TypeAttributes} - The derived type
    * attributes.
    */
  lightTypeAttributes (type) {
    const Cats = this.Accessory.Categories
    switch (type) {
      case 'Color dimmable light':
        return new TypeAttributes(Cats.LIGHTBULB, 'LightBulb', 4)
      case 'Color light':
        return new TypeAttributes(Cats.LIGHTBULB, 'LightBulb', 3)
      case 'Color temperature light':
        return new TypeAttributes(Cats.LIGHTBULB, 'LightBulb', 2)
      case 'Dimmable light':
        return new TypeAttributes(Cats.LIGHTBULB, 'LightBulb', 1)
      case 'Dimmable plug-in unit':
        return new TypeAttributes(Cats.LIGHTBULB, 'LightBulb')
      case 'Extended color light':
        return new TypeAttributes(Cats.LIGHTBULB, 'LightBulb', 5)
      case 'Consumption awareness device':
        return new TypeAttributes(Cats.LIGHTBULB)
      case 'Dimmer switch':
        return new TypeAttributes(Cats.LIGHTBULB, 'LightBulb')
      case 'Level control switch':
        return new TypeAttributes(Cats.LIGHTBULB, 'LightBulb')
      case 'Level controllable output':
        return new TypeAttributes(Cats.OTHER)
      case 'Door Lock':
        return new TypeAttributes(Cats.DOOR_LOCK)
      case 'Door Lock Unit':
        return new TypeAttributes(Cats.DOOR_LOCK)
      case 'Fan':
        return new TypeAttributes(Cats.FAN)
      case 'On/Off light switch':
        return new TypeAttributes(Cats.SWITCH, 'Outlet')
      case 'On/Off light':
        return new TypeAttributes(Cats.OUTLET, 'Outlet')
      case 'On/Off output':
        return new TypeAttributes(Cats.OUTLET, 'Outlet')
      case 'On/Off plug-in unit':
        return new TypeAttributes(Cats.OUTLET, 'Outlet')
      case 'Smart plug':
        return new TypeAttributes(Cats.OUTLET, 'Outlet')
      case 'Configuration tool':
        return new TypeAttributes(Cats.BRIDGE)
      case 'Range extender':
        return new TypeAttributes(Cats.RANGE_EXTENDER)
      case 'Warning device':
        return new TypeAttributes(Cats.SECURITY_SYSTEM, 'WarningDevice')
      case 'Window covering controller':
        return new TypeAttributes(Cats.WINDOW_COVERING, 'WindowCovering')
      case 'Window covering device':
        return new TypeAttributes(Cats.WINDOW_COVERING, 'WindowCovering')
      default:
        return new TypeAttributes()
    }
  }

  /** Derivce the attributes for a `/sensors` resource type.
    *
    * @params {string} type - The `type` attribute of the `/sensors` resource.
    * @return {DeconzAccessory.Gateway.TypeAttributes} - The derived type
    * attributes.
    */
  sensorTypeAttributes (type) {
    const Cats = this.Accessory.Categories
    switch (type) {
      case 'ZHAAirPurifier':
      case 'CLIPAirPurifier':
        return new TypeAttributes(Cats.AIR_PURIFIER)
      case 'ZHAAirQuality':
      case 'CLIPAirQuality':
        return new TypeAttributes(Cats.SENSOR, 'AirQuality', 3)
      case 'ZHAAlarm':
      case 'CLIPAlarm':
        return new TypeAttributes(Cats.SECURITY_SYSTEM, 'Alarm')
      case 'ZHAAncillaryControl':
      case 'CLIPAncillaryControl':
        return new TypeAttributes(Cats.SECURITY_SYSTEM)
      case 'ZHABattery':
      case 'CLIPBattery':
        return new TypeAttributes(Cats.SENSOR, 'Battery')
      case 'ZHACarbonMonoxide':
      case 'CLIPCarbonMonoxide':
        return new TypeAttributes(Cats.SENSOR, 'CarbonMonoxide')
      case 'ZHAConsumption':
      case 'CLIPConsumption':
        return new TypeAttributes(Cats.SENSOR, 'Consumption')
      case 'ZHADoorLock':
      case 'CLIPDoorLock':
        return new TypeAttributes(Cats.DOOR_LOCK)
      case 'Daylight':
        return new TypeAttributes(Cats.SENSOR, 'Daylight')
      case 'ZHAFire':
      case 'CLIPFire':
        return new TypeAttributes(Cats.SENSOR, 'Fire')
      case 'CLIPGenericFlag':
        return new TypeAttributes(Cats.SWITCH, 'Flag')
      case 'CLIPGenericStatus':
        return new TypeAttributes(Cats.OTHER, 'Status')
      case 'ZHAHumidity':
      case 'CLIPHumidity':
        return new TypeAttributes(Cats.SENSOR, 'Humidity', 4)
      case 'ZHALightLevel':
      case 'CLIPLightLevel':
        return new TypeAttributes(Cats.SENSOR, 'LightLevel', 6)
      case 'ZHAMoisture':
      case 'CLIPMoisture':
        return new TypeAttributes(Cats.SENSOR)
      case 'ZHAOpenClose':
      case 'CLIPOpenClose':
        return new TypeAttributes(Cats.SENSOR, 'OpenClose', 8)
      case 'ZHAPower':
      case 'CLIPPower':
        return new TypeAttributes(Cats.SENSOR, 'Power', 1)
      case 'ZHAPresence':
      case 'CLIPPresence':
        return new TypeAttributes(Cats.SENSOR, 'Presence', 7)
      case 'ZHAPressure':
      case 'CLIPPressure':
        return new TypeAttributes(Cats.SENSOR, 'Pressure', 3)
      case 'ZHASpectral':
        return new TypeAttributes(Cats.SENSOR)
      case 'ZGPSwitch':
      case 'ZHASwitch':
        return new TypeAttributes(Cats.PROGRAMMABLE_SWITCH, 'Switch')
      case 'CLIPSwitch':
        return new TypeAttributes(Cats.PROGRAMMABLE_SWITCH)
      case 'ZHATemperature':
      case 'CLIPTemperature':
        return new TypeAttributes(Cats.SENSOR, 'Temperature', 5)
      case 'ZHAThermostat':
      case 'CLIPThermostat':
        return new TypeAttributes(Cats.THERMOSTAT, 'Thermostat')
      case 'ZHATime':
      case 'CLIPTime':
        return new TypeAttributes(Cats.WINDOW_COVERING)
      case 'ZHAVibration':
      case 'CLIPVibration':
        return new TypeAttributes(Cats.SENSOR, 'Vibration')
      case 'ZHAWater':
      case 'CLIPWater':
        return new TypeAttributes(Cats.SENSOR, 'Water')
      default:
        return new TypeAttributes()
    }
  }
}

/** A Zigbee or virtual devices exposed by the gateway.
  *
  * @memberof DeconzAccessory.Gateway
  */
class Device {
  static get Resource () { return Resource }

  /** Instantiate a Device from a gayeway resource.
    *
    * @param {string} rtype - The type of the resource:
    * `config`, `group`, `light`, or `sensor`.
    * @param {integer} rid - The resource ID of the resource.
    * @param {object} body - The body of the resource.
    * @params {DeconzAccessory.Gateway.ResourceAttributes} attrs - Derived
    * resource attributes.
    */
  constructor (rtype, rid, body, attrs) {
    /** The device ID.
      *
      * For Zigbee devices, the device ID is based on the Zigbee mac address
      * of the device.
      * For virtual devices, the device ID is based on the Zigbee mac address
      * of the gayeway and the resource.
      * The UUID of the associated HomeKit accessory is based on the device ID.
      * @type {string}
      */
    this.id = attrs.id

    /** Zigbee device vs virtual device.
      * @type {boolean}
      */
    this.zigbee = attrs.zigbee

    /** A map of Resource by subtype.
      * @type {Object.<string, DeconzAccessory.Gateway.Device.Resource>}
      */
    this.resourceMap = {}
  }

  /** Add a Resource from a gayeway resource.
    *
    * @param {string} rtype - The type of the resource:
    * `config`, `group`, `light`, or `sensor`.
    * @param {integer} rid - The resource ID of the resource.
    * @param {object} body - The body of the resource.
    * @params {DeconzAccessory.Gateway.ResourceAttributes} - Derived resource
    * attributes.
    */
  addResource (rtype, rid, body, attrs) {
    const { id, subtype, zigbee } = attrs
    if (this.resourceMap[subtype] != null) {
      const r = this.resourceMap[subtype]
      throw new Error(
        `${attrs.resource}: duplicate uniqueid ${body.uniqueid} in ${r.attrs.resource}`
      )
    }
    if (zigbee !== this.zigbee || (zigbee && id !== this.id)) {
      const r = this.resourceMap[subtype]
      throw new SyntaxError(
        `${attrs.resource}: cannot combine ${r.attrs.resource}`
      )
    }
    this.resourceMap[subtype] = new Resource(rtype, rid, body, attrs)
    if (
      this.primary == null ||
      this.resourceMap[this.primary].attrs.prio < attrs.prio
    ) {
      /** The subtype of the primary
        * {@link DeconzAccessory.Gateway.Device.Resource Resource}.
        *
        * @type {string}
        */
      this.primary = subtype
    }
    return this.resourceMap[subtype]
  }
}

/** A resource exposed by the gateway.
  *
  * @memberof DeconzAccessory.Gateway.Device
  */
class Resource {
  /** Instantiate a Resource from a gayeway resource.
    *
    * @param {string} rtype - The type of the resource:
    * `config`, `group`, `light`, or `sensor`.
    * @param {integer} rid - The resource ID of the resource.
    * @param {object} body - The body of the resource.
    * @params {DeconzAccessory.Gateway.ResourceAttributes} attrs - Derived
    * resource attributes.
    */
  constructor (rtype, rid, body, attrs) {
    /** The resource type: `groups`, `lights`, or `sensors`.
      * @type {string}
      */
    this.rtype = rtype

    /** The resource ID.
      * @type {integer}
      */
    this.rid = rid

    /** The resource body.
      * @param {object}
      */
    this.body = body

    this.attrs = attrs
  }

  /** The associated HomeKit Accessory category.
    * `null` for unknown types.
    * @type {?Accessory.Category}
    */
  get category () { return this.attrs.type.category }

  /** The associated device ID.
    *
    * For Zigbee devices, the device ID is based on the Zigbee mac address
    * of the device.
    * For virtual devices, the device ID is based on the Zigbee mac address
    * of the gayeway and the resource.
    * The UUID of the associated HomeKit accessory is based on the device ID.
    * @type {string}
    */
  get id () { return this.attrs.id }

  /** The priority of the resource type when determining the primary service.
    * @type {integer}
    */
  get prio () { return this.attrs.type.prio }

  /** The resource exposed by the gateway, e.g. `/lights/1`
    * @type {string}
    */
  get rpath () { return '/' + this.rtype + '/' + this.rid }

  /** The name of the DeconzService to expose the resouce type.
    * `null` for unsupported types.
    * @type {string}
    */
  get serviceName () { return this.attrs.type.serviceName }

  /** The subtype of the associated HomeKit service.
    *
    * For Zigbee devices, the subtype is based on the Zigbee endpoint and
    * cluster, corresponding to the resouce.
    * For virtual devices, the subtype is based on the resource.
    * @type {string[]}
    */
  get subtype () { return this.attrs.subtype }

  /** Zigbee device vs virtual device.
    * @type {boolean}
    */
  get zigbee () { return this.attrs.zigbee }
}

/** Derived attributes of a resource.
  * @hideconstructor
  * @memberof DeconzAccessory.Gateway
  */
class ResourceAttributes {
  constructor (id, subtype, type, zigbee) {
    /** The associated device ID.
      *
      * For Zigbee devices, the device ID is based on the Zigbee mac address
      * of the device.
      * For virtual devices, the device ID is based on the Zigbee mac address
      * of the gayeway and the resource.
      * The UUID of the associated HomeKit accessory is based on the device ID.
      * @type {string}
      */
    this.id = id

    /** The subtype of the associated HomeKit service.
      *
      * For Zigbee devices, the subtype is based on the Zigbee endpoint and
      * cluster, corresponding to the resouce.
      * For virtual devices, the subtype is based on the resource.
      * @type {string}
      */
    this.subtype = subtype

    /** The derviced attributes of the resource type.
      * @type {DeconzAccessory.Gateway.TypeAttributes}
      */
    this.type = type

    /** Zigbee device vs virtual device.
      * @type {boolean}
      */
    this.zigbee = zigbee
  }
}

/** Derived attributes of a resource type.
  * @hideconstructor
  * @memberof DeconzAccessory.Gateway
  */
class TypeAttributes {
  constructor (category, serviceName, prio = 0) {
    /** The associated HomeKit Accessory category.
      * `null` for unknown types.
      * @type {?Accessory.Category}
      */
    this.category = category

    /** The name of the {@link DeconzService} to expose the resouce type.
      * `null` for unsupported types.
      * @type {string}
      */
    this.serviceName = serviceName

    /** The priority of the resource type when determining the primary service.
      * @type {integer}
      */
    this.prio = prio
  }
}

module.exports = Gateway
