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

    for (const subtype in this.device.resourceMap) {
      const { rpath } = this.device.resourceMap[subtype]
      this.debug('%s', rpath)
      this.gateway.accessoryByRpath[rpath] = this
      this
        .on('polled', (rpath, body) => {
          this.debug('%s: polled', rpath)
        })
        .on('changed', (rpath, body) => {
          this.debug('%s: changed: %j', rpath, body)
        })
    }
    const resource = this.device.resourceMap[this.device.primary]

    this.deviceService = new DeconzService.Device(this, {
      name: this.name,
      subtype: this.id,
      resource: resource.rpath,
      expose: true
    })

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
  get resources () {
    return Object.keys(this.device.resourceMap || {}).map((subtype) => {
      return this.device.resourceMap[subtype].rpath
    }).sort()
  }

  identify () {
    this.log(
      '%s %s v%s (%d resources)', this.values.manufacturer, this.values.model,
      this.values.firmware, this.resources.length
    )
    this.debug('%d resources: %j', this.resources.length, this.resources)
  }

  destroy () {
    for (const subtype in this.device.resourceMap) {
      const { rpath } = this.device.resourceMap[subtype]
      delete this.gateway.accessoryByRpath[rpath]
    }
    super.destroy()
  }
}

module.exports = Device
