// homebridge-deconz/lib/DeconzAccessory/Device.js
// Copyright © 2022 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const homebridgeLib = require('homebridge-lib')
const DeconzService = require('../DeconzService')

/** Delegate class for a device exposed by the gateway.
  * @extends AccessoryDelegate
  * @memberof DeconzAccessory
  */
class Device extends homebridgeLib.AccessoryDelegate {
  /** Instantiate a gateway delegate.
    * @param {DeconzAccessory.Gateway} gateway - The gateway delegate.
    * @param {DeconzAccessory.Gateway.Device} device - The device.
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
      category: category
    })
    this.gateway = gateway
    this.id = device.id
    this.device = device
    this.inheritLogLevel(gateway)

    this.identify()

    this
      .on('polled', (device) => {
        this.debug('%j: polled', device.rpaths)
      })
      .on('changed', (rpath, body) => {
        this.debug('%s: changed: %j', rpath, body)
      })

    this.deviceService = new DeconzService.DeviceSettings(this, {
      name: this.name,
      subtype: this.id,
      resource: this.rpaths.join(', '),
      expose: true
    })

    this.dummyService = new homebridgeLib.ServiceDelegate.Dummy(this)

    this
      .on('identify', this.identify)

    setImmediate(() => {
      this.debug('initialised')
      this.emit('initialised')
    })
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
    this.debug('%d resources: %j', this.rpaths.length, this.rpaths)
  }
}

module.exports = Device
