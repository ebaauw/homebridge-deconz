// homebridge-deconz/lib/DeconzAccessory/index.js
// Copyright © 2022 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const homebridgeLib = require('homebridge-lib')

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
      category: category,
      logLevel: gateway.logLevel
    })

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
}

module.exports = DeconzAccessory
