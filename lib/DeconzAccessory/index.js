// homebridge-deconz/lib/DeconzAccessory/index.js
// Copyright© 2022-2023 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const { AccessoryDelegate, OptionParser } = require('homebridge-lib')
const { ApiClient } = require('hb-deconz-tools')
const DeconzService = require('../DeconzService')

const { HttpError } = ApiClient
const { SINGLE, DOUBLE, LONG } = DeconzService.Button

/** Abstract superclass for a delegate of a HomeKit accessory,
  * corresponding to a Zigbee or virtual device on a deCONZ gateway.
  * @extends AccessoryDelegate
  */
class DeconzAccessory extends AccessoryDelegate {
  static get Light () { return require('./Light') }
  static get Gateway () { return require('./Gateway') }
  static get Outlet () { return DeconzAccessory.Light }
  static get Sensor () { return require('./Sensor') }
  static get Switch () { return DeconzAccessory.Light }
  static get WarningDevice () { return require('./WarningDevice') }
  static get WindowCovering () { return require('./WindowCovering') }

  /** Instantiate a delegate for an accessory corresponding to a device.
    * @param {DeconzAccessory.Gateway} gateway - The gateway.
    * @param {Deconz.Device} device - The device.
    * @param {Accessory.Category} category - The HomeKit accessory category.
    */
  constructor (gateway, device, category) {
    super(gateway.platform, {
      id: device.id,
      name: device.resource.body.name,
      manufacturer: device.resource.manufacturer,
      model: device.resource.model,
      firmware: device.resource.firmware,
      category,
      logLevel: gateway.logLevel
    })

    this.context.gid = gateway.id

    this.serviceByRpath = {}
    this.serviceBySubtype = {}
    this.servicesByServiceName = {}

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
      * @type {ApiClient}
      */
    this.client = gateway.client

    this
      .on('polled', (device) => {
        let reExpose = false
        this.values.firmware = device.resource.firmware
        for (const subtype in device.resourceBySubtype) {
          const resource = device.resourceBySubtype[subtype]
          this.debug('%s: polled: %j', resource.rpath, resource.body)
          const service = this.serviceBySubtype[subtype]
          if (service == null) {
            this.log('%s: new resource: %j', resource.rpath, resource.body)
            reExpose = true
          } else {
            service.update(resource.body, resource.rpath)
          }
        }
        for (const subtype in this.serviceBySubtype) {
          const service = this.serviceBySubtype[subtype]
          const resource = device.resourceBySubtype[subtype]
          if (resource == null) {
            this.log('%s: resource deleted', service.rpath)
            reExpose = true
          }
        }
        if (reExpose) {
          this.gateway.reExposeAccessory(this.id)
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
    this.vdebug('device: %j', this.device)
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
    if (params.serviceName === 'AirQuality') {
      service = this.servicesByServiceName.AirQuality?.[0]
      if (service != null) {
        service.addResource(resource)
      }
    } else if (params.serviceName === 'Battery') {
      service = this.servicesByServiceName.Battery?.[0]
    } else if (params.serviceName === 'Consumption') {
      service = this.servicesByServiceName.Power?.[0]
      if (service != null) {
        service.addResource(resource)
      }
    } else if (params.serviceName === 'Power') {
      service = this.servicesByServiceName.Consumption?.[0]
      if (service != null) {
        service.addResource(resource)
      }
    } else if (params.serviceName === 'Label') {
      service = this.servicesByServiceName.Label?.[0]
      // Default button
      if (resource.capabilities.buttons == null) {
        if (service == null) {
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
        } else {
          resource.capabilities.buttons = {}
        }
      }
    }
    if (service == null) {
      service = new DeconzService[params.serviceName](this, resource, {
        primaryService: params.primaryService
      })
    }
    if (this.servicesByServiceName[params.serviceName] == null) {
      this.servicesByServiceName[params.serviceName] = [service]
    } else {
      this.servicesByServiceName[params.serviceName].push(service)
    }
    if (params.serviceName === 'Label') {
      service.createButtonServices(resource, params)
    }
    this.serviceBySubtype[resource.subtype] = service
    this.serviceByRpath[resource.rpath] = service
    if (resource.body.config?.battery !== undefined) {
      if (this.servicesByServiceName.Battery?.[0] == null) {
        this.servicesByServiceName.Battery = [new DeconzService.Battery(this, resource)]
      }
      service.batteryService = this.servicesByServiceName.Battery[0]
    }
    return service
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
            logLevel: this.values.logLevel,
            lowBatteryThreshold: this.servicesByServiceName?.Battery?.[0].values.lowBatteryThreshold,
            // offset: this.servicesByServiceName?.Temperature?.[0].values.offset,
            serviceName: this.values.serviceName,
            splitLight: undefined,
            venetianBlind: this.service.values.venetianBlind,
            wallSwitch: this.service.values.wallSwitch
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
            value = OptionParser.toInt(key, body[key], 0, 3)
            this.values[key] = value
            responseBody[key] = value
            continue
          case 'lowBatteryThreshold':
            if (this.servicesByServiceName.Battery?.[0] != null) {
              value = OptionParser.toInt(key, body[key], 10, 100)
              this.servicesByServiceName.Battery[0].values[key] = value
              responseBody[key] = value
              continue
            }
            break
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
          case 'wallSwitch':
            if (this.service.values[key] != null) {
              value = OptionParser.toBool(key, body[key])
              this.service.values[key] = value
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
