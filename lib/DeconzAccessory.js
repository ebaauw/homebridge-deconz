// homebridge-deconz/lib/DeconzAccessory.js
// Copyright © 2022 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const homebridgeLib = require('homebridge-lib')

/** Abstract superclass for a delegate of a HomeKit accessory,
  * corresponding to a Zigbee or virtual device on a deCONZ gateway.
  */
class DeconzAccessory extends homebridgeLib.AccessoryDelegate {
  static get Gateway () { return require('./DeconzAccessory/Gateway') }
  static get Device () { return require('./DeconzAccessory/Device') }

  /** Instantiate a delegate for an accessory corresponding to a device.
    * @param {DeconzAccessory.Gateway} gateway - The gateway.
    * @param {DeconzDevice} device - The device.
    */
  constructor (gateway, device) {
    const { body, category } = device.resource
    super(gateway.platform, {
      id: device.id,
      name: body.name,
      manufacturer: device.zigbee
        ? body.manufacturername
        : gateway.values.manufacturer,
      model: device.zigbee ? body.modelid : body.type,
      firmware: device.Zigbee
        ? body.swversion == null ? '0.0.0' : body.swversion
        : gateway.values.software,
      category: category,
      logLevel: gateway.logLevel
    })

    /** The gateway.
      * @type {DeconzAccessory.Gateway}
      */
    this.gateway = gateway

    /** The accessory ID.
      *
      * This is the {@link DeconzDevice#id id} of the corresponding device.
      * @type {string}
      */
    this.id = device.id

    /** The corresponding device.
      * @type {DeconzDevice}
      */
    this.device = device
  }

  /** The primary resource of the device.
    * @type {DeconzDevice.Resource}
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
