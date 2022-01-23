// homebridge-deconz/lib/DeconzAccessory/index.js
// Copyright © 2022 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const homebridgeLib = require('homebridge-lib')
const DeconzService = require('../DeconzService')

const { SINGLE, DOUBLE, LONG } = DeconzService.Button

/** Abstract superclass for a delegate of a HomeKit accessory,
  * corresponding to a Zigbee or virtual device on a deCONZ gateway.
  */
class DeconzAccessory extends homebridgeLib.AccessoryDelegate {
  static get Device () { return require('./Device') }
  static get Light () { return require('./Light') }
  static get Gateway () { return require('./Gateway') }

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
      category: category
    })

    this.serviceBySubtype = {}
    this.serviceByRpath = {}

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
          const service = this.serviceBySubtype[subtype]
          const resource = device.resourceBySubtype[subtype]
          this.debug('%s: polled: %j', resource.rpath, resource.body)
          service.update(resource.body, resource.rpath)
        }
      })
      .on('changed', (rpath, body) => {
        this.debug('%s: changed: %j', rpath, body)
        const service = this.serviceByRpath[rpath]
        if (service != null) {
          this.service.update(body, rpath)
        }
      })
      .on('identify', this.identify)
  }

  /** The primary resource of the device.
    * @type {Deconz.Resource}
    */
  get resource () { return this.device.resource }

  /** List of resource paths of associated resources in order of prio.
    * @type {string[]}
    */
  get rpaths () { return this.device.rpaths }

  identify () {
    this.log(
      '%s %s v%s (%d resources)', this.values.manufacturer, this.values.model,
      this.values.firmware, this.rpaths.length
    )
    this.debug('%d resources: %s', this.rpaths.length, this.rpaths.join(', '))
  }

  createService (resource, settings = {}) {
    if (settings.serviceName == null) {
      settings.serviceName = resource.serviceName
    }
    if (DeconzService[settings.serviceName] == null) {
      this.warn(
        '%s: not yet supported %s type', resource.body.type, resource.rtype
      )
      settings.serviceName = 'Switch'
      resource.capabilities.buttons = {
        1: {
          label: 'Dummy Button',
          events: SINGLE | LONG
        }
      }
      resource.capabilities.namespace =
        this.Characteristics.hap.ServiceLabelNamespace.ARABIC_NUMERALS
    }
    this.debug(
      '%s: capabilities: %j', resource.rpath, resource.capabilities
    )
    this.debug('%s: settings: %j', resource.rpath, settings)

    let service
    if (settings.serviceName === 'Switch') {
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
      if (this.switchService == null) {
        this.switchService = new DeconzService.Switch(this, resource, {
          primaryService: settings.primaryService
        })
      }
      service = this.switchService
      service.createButtonServices(resource, settings)
    } else if (settings.serviceName === 'Battery') {
      if (this.batteryService == null) {
        this.batteryService = new DeconzService.Battery(this, resource)
      }
      service = this.batteryService
    } else {
      service = new DeconzService[settings.serviceName](this, resource, {
        primaryService: settings.primaryService
      })
    }
    this.serviceBySubtype[resource.subtype] = service
    this.serviceByRpath[resource.rpath] = service
    if (resource.body.config != null && resource.body.config.battery != null) {
      if (this.batteryService != null) {
        this.batteryService = new DeconzService.Battery(this, resource)
      }
    }
    return service
  }
}

module.exports = DeconzAccessory
