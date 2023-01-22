// homebridge-deconz/lib/DeconzAccessory/index.js
// Copyright © 2022 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const homebridgeLib = require('homebridge-lib')
const { OptionParser } = homebridgeLib
const Deconz = require('../Deconz')
const DeconzService = require('../DeconzService')

const { HttpError } = Deconz.ApiClient
const { SINGLE, DOUBLE, LONG } = DeconzService.Button

/** Abstract superclass for a delegate of a HomeKit accessory,
  * corresponding to a Zigbee or virtual device on a deCONZ gateway.
  * @extends AccessoryDelegate
  */
class DeconzAccessory extends homebridgeLib.AccessoryDelegate {
  static get Light () { return require('./Light') }
  static get Gateway () { return require('./Gateway') }
  static get Sensor () { return require('./Sensor') }
  static get WarningDevice () { return require('./WarningDevice') }
  static get WindowCovering () { return require('./WindowCovering') }

  /** Instantiate a delegate for an accessory corresponding to a device.
    * @param {DeconzAccessory.Gateway} gateway - The gateway.
    * @param {Deconz.Device} device - The device.
    * @param {Accessory.Category} category - The HomeKit accessory category.
    */
  constructor (gateway, device, category) {
    // TODO device settings
    super(gateway.platform, {
      id: device.id,
      name: device.resource.body.name,
      manufacturer: device.resource.manufacturer,
      model: device.resource.model,
      firmware: device.resource.firmware,
      category
    })
    this.values.logLevel = gateway.logLevel

    this.context.gid = gateway.id

    this.serviceByRpath = {}
    this.serviceBySubtype = {}
    this.serviceByServiceName = {}

    /** The gateway.
      * @type {DeconzAccessory.Gateway}
      */
    this.gateway = gateway

    /** The accessory ID.
      *
      * This is the {@link Deconz.Device#id id} of the corresponding device.
      * @type {string}
      */
    this.id = device.id

    /** The corresponding device.
      * @type {Deconz.Device}
      */
    this.device = device

    /** The API client instance for the gateway.
      * @type {Deconz.ApiClient}
      */
    this.client = gateway.client

    this
      .on('polled', (device) => {
        this.values.firmware = device.resource.firmware
        for (const subtype in this.serviceBySubtype) {
          try {
            const service = this.serviceBySubtype[subtype]
            const resource = device.resourceBySubtype[subtype]
            this.debug('%s: polled: %j', resource.rpath, resource.body)
            service.update(resource.body, resource.rpath)
          } catch (error) { this.error(error) }
        }
      })
      .on('changed', (rpath, body) => {
        this.debug('%s: changed: %j', rpath, body)
        const service = this.serviceByRpath[rpath]
        if (service != null) {
          service.update(body, rpath)
        }
      })
      .on('identify', async () => {
        try {
          await this.identify()
        } catch (error) {
          if (!(error instanceof HttpError)) {
            this.warn(error)
          }
        }
      })
  }

  /** The primary resource of the device.
    * @type {Deconz.Resource}
    */
  get resource () { return this.device.resource }

  /** List of resource paths of associated resources in order of prio.
    * @type {string[]}
    */
  get rpaths () { return this.device.rpaths }

  async identify () {
    this.log(
      '%s %s v%s (%d resources)', this.values.manufacturer, this.values.model,
      this.values.firmware, this.rpaths.length
    )
    this.debug('%d resources: %s', this.rpaths.length, this.rpaths.join(', '))
    if (this.service != null) {
      await this.service.identify()
    }
  }

  createService (resource, params = {}) {
    if (resource == null) {
      return
    }
    if (params.serviceName == null) {
      params.serviceName = resource.serviceName
    }
    if (DeconzService[params.serviceName] == null) {
      this.warn(
        '%s: %s: not yet supported %s type',
        resource.rpath, resource.body.type, resource.rtype
      )
      return
    }
    this.debug(
      '%s: capabilities: %j', resource.rpath, resource.capabilities
    )
    this.debug('%s: params: %j', resource.rpath, params)

    let service
    if (params.serviceName === 'Battery') {
      service = this.serviceByServiceName.Battery
    } else if (params.serviceName === 'Consumption') {
      service = this.serviceByServiceName.Outlet ||
        this.serviceByServiceName.Light ||
        this.serviceByServiceName.Power
      if (service != null) {
        service.addResource(resource)
      }
    } else if (params.serviceName === 'Power') {
      service = this.serviceByServiceName.Outlet ||
        this.serviceByServiceName.Light ||
        this.serviceByServiceName.Consumption
      if (service != null) {
        service.addResource(resource)
      }
    } else if (params.serviceName === 'Switch') {
      // Default button
      if (resource.capabilities.buttons == null) {
        this.warn(
          '%s: unknown %s: %j', resource.rpath, resource.body.type,
          resource.body
        )
        resource.capabilities.buttons = {
          1: {
            label: 'Unknown Button',
            events: SINGLE | DOUBLE | LONG
          }
        }
        resource.capabilities.namespace =
          this.Characteristics.hap.ServiceLabelNamespace.ARABIC_NUMERALS
      }
      service = this.serviceByServiceName.Switch
      if (service == null) {
        service = new DeconzService.Switch(this, resource, {
          primaryService: params.primaryService
        })
      }
      service.createButtonServices(resource, params)
    }
    if (service == null) {
      service = new DeconzService[params.serviceName](this, resource, {
        primaryService: params.primaryService
      })
    }
    this.serviceBySubtype[resource.subtype] = service
    this.serviceByRpath[resource.rpath] = service
    if (this.serviceByServiceName[params.serviceName] == null) {
      this.serviceByServiceName[params.serviceName] = service
    }
    if (
      resource.body.config != null &&
      resource.body.config.battery !== undefined
    ) {
      if (this.serviceByServiceName.Battery == null) {
        this.serviceByServiceName.Battery = new DeconzService.Battery(this, resource)
      }
      service.batteryService = this.serviceByServiceName.Battery
    }
    return service
  }

  settings = {
    anyOn: { service: 'Lightbulb', type: 'bool' },
    buttonRepeat: { service: 'Button', type: 'boolMap' },
    effects: { service: 'Light', type: 'boolMap' },
    expose: { type: 'bool' },
    logLevel: { type: 'int', min: 0, max: 3 },
    lowBatteryThreshold: { service: 'Battery', type: 'int', min: 10, max: 100, factor: 100 },
    offset: { service: 'Temperature', type: 'number', min: -5, max: 5 },
    splitLight: { service: 'Light' }
  }

  onUiGet (details = false) {
    const resource = this.device.resourceBySubtype[this.device.primary]
    const body = {
      id: details ? this.id : undefined,
      manufacturer: this.values.manufacturer,
      model: this.values.model,
      name: this.name,
      resources: this.device.rpaths,
      settings: details
        ? {
            anyOn: this.device.resource.rtype === 'groups'
              ? this.values.anyOn
              : undefined,
            buttonRepeat: undefined, // map per button
            expose: true,
            exposeEffects: this.service.values.exposeEffects,
            exposeScenes: this.service.values.exposeScenes,
            multiClip: undefined,
            multiLight: undefined,
            logLevel: this.logLevel,
            lowBatteryThreshold: this.serviceByServiceName.Battery == null
              ? undefined
              : this.serviceByServiceName.Battery.values.lowBatteryThreshold,
            // offset: this.serviceByServiceName.Temperature == null
            //   ? undefined
            //   : this.serviceByServiceName.Temperature.values.offset,
            serviceName: this.values.serviceName,
            splitLight: undefined,
            venetianBlind: this.service.values.venetianBlind,
            wallSwitch: undefined
          }
        : undefined,
      type: resource.rtype,
      zigbee: this.device.zigbee
    }
    return { status: 200, body }
  }

  onUiPut (body) {
    let reExpose = false
    const responseBody = {}
    for (const key in body) {
      try {
        let value
        switch (key) {
          case 'expose':
            value = OptionParser.toBool(key, body[key])
            if (value) {
              reExpose = true
            } else {
              this.gateway.exposeDevice(this.id, value)
            }
            responseBody[key] = value
            continue
          // Settings for the primary service.
          case 'anyOn':
          case 'exposeEffects':
          case 'exposeScenes':
          case 'venetianBlind':
            if (this.service.values[key] != null) {
              value = OptionParser.toBool(key, body[key])
              this.service.values[key] = value
              reExpose = true
              responseBody[key] = value
              continue
            }
            break
          case 'logLevel':
            value = OptionParser.toInt(key, body[key], 0, 1)
            this.values[key] = value
            responseBody[key] = value
            continue
          case 'lowBatteryThreshold':
            if (this.serviceByServiceName.Battery != null) {
              value = OptionParser.toInt(key, body[key], 10, 100)
              this.serviceByServiceName.Battery.values[key] = value
              responseBody[key] = value
              continue
            }
            break
          // case 'offset': // TODO: doesn't work because of fromHomeKit
          //   if (this.serviceByServiceName.Temperature != null) {
          //     const value = OptionParser.toNumber(key, body[key], -5, 5)
          //     this.serviceByServiceName.Temperature.values[key] = value
          //     responseBody[key] = value
          //     continue
          //   }
          //   break
          case 'serviceName':
            if (this.values.serviceName != null) {
              value = OptionParser.toString(key, body[key])
              if (DeconzService[value] == null) {
                throw new Error(`${value}: illegal serviceName`)
              }
              this.values.serviceName = value
              reExpose = true
              responseBody[key] = value
              continue
            }
            break
          default:
            break
        }
        this.warn('ui error: %s: invalid key', key)
      } catch (error) { this.warn('ui error: %s', error) }
    }
    if (reExpose) {
      this.gateway.reExposeAccessory(this.id)
    }
    return { status: 200, body: responseBody }
  }
}

module.exports = DeconzAccessory
