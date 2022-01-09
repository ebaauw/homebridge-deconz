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
  constructor (gateway, params) {
    super(gateway.platform, params)
    this.gateway = gateway
    this.id = params.id
    this.device = params.device
    this.inheritLogLevel(gateway)

    this.identify()

    this
      .on('polled', (rpath, body) => {
        this.debug('%s: polled', rpath)
      })
      .on('changed', (rpath, body) => {
        this.debug('%s: changed: %j', rpath, body)
      })

    const resource = this.device.resourceMap[this.device.primary]

    this.deviceService = new DeconzService.DeviceSettings(this, {
      name: this.name,
      subtype: this.id,
      resource: resource.rpath,
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

  /** List of resource paths of associated resources.
    * @type {string[]}
    */
  get rpaths () {
    return Object.keys(this.device.resourceMap || {}).map((subtype) => {
      return this.device.resourceMap[subtype].rpath
    }).sort()
  }

  identify () {
    this.log(
      '%s %s v%s (%d resources)', this.values.manufacturer, this.values.model,
      this.values.firmware, this.rpaths.length
    )
    this.debug('%d resources: %j', this.rpaths.length, this.rpaths)
  }
}

module.exports = Device
