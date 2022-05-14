// homebridge-deconz/lib/DeconzAccessory/index.js
// Copyright © 2022 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const homebridgeLib = require('homebridge-lib')
const Deconz = require('../Deconz')
const DeconzService = require('../DeconzService')

const { HttpError } = Deconz.ApiClient
const { SINGLE, DOUBLE, LONG } = DeconzService.Button

/** Abstract superclass for a delegate of a HomeKit accessory,
  * corresponding to a Zigbee or virtual device on a deCONZ gateway.
  * @extends AccessoryDelegate
  */
class DeconzAccessory extends homebridgeLib.AccessoryDelegate {
  static get Contact () { return require('./Contact') }
  static get Light () { return require('./Light') }
  static get Gateway () { return require('./Gateway') }
  static get Motion () { return require('./Motion') }
  static get Sensor () { return require('./Sensor') }
  static get Temperature () { return require('./Temperature') }
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
      service = this.serviceByServiceName.Light ||
        this.serviceByServiceName.Power
      if (service != null) {
        service.addResource(resource)
      }
    } else if (params.serviceName === 'Power') {
      service = this.serviceByServiceName.Light ||
        this.serviceByServiceName.Consumption
      if (service != null) {
        service.addResource(resource)
      }
      this.consumptionService = service
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
    if (this.serviceByServiceName[resource.serviceName] == null) {
      this.serviceByServiceName[resource.serviceName] = service
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

  createSettingsService (params = {}) {
    this.settingsService = new DeconzService.DeviceSettings(this, {
      name: this.name + ' Settings',
      subtype: this.id,
      resource: this.device.rpaths.join(', '),
      expose: true,
      logLevel: this.gateway.logLevel,
      hasRepeat: this.service.hasRepeat
    })
    this.manageLogLevel(this.settingsService.characteristicDelegate('logLevel'))
  }
}

module.exports = DeconzAccessory
