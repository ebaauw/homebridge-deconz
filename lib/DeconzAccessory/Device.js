// homebridge-deconz/lib/DeconzAccessory/Device.js
// Copyright © 2022 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const DeconzAccessory = require('.')
const DeconzService = require('../DeconzService')

/** Delegate class for a HomeKit accessory,
  * corresponding to a Zigbee or virtual device on a deCONZ gateway,
  * that is not yet supported.
  * @extends DeconzAccessory
  * @memberof DeconzAccessory
  */
class Device extends DeconzAccessory {
  /** Instantiate a delegate for an accessory corresponding to a device.
    * @param {DeconzAccessory.Gateway} gateway - The gateway.
    * @param {Deconz.Device} device - The device.
    */
  constructor (gateway, device) {
    super(gateway, device)

    this.identify()

    this.service = new DeconzService.Button(this, {
      name: this.name + ' Button',
      button: 1,
      events: DeconzService.Button.SINGLE | DeconzService.Button.LONG,
      primaryService: true
    })

    this.settingsService = new DeconzService.DeviceSettings(this, {
      name: this.name + ' Settings',
      subtype: this.id,
      resource: this.device.rpaths.join(', '),
      expose: true,
      logLevel: gateway.logLevel
    })

    this
      .on('polled', (device) => {
        this.vdebug('%s: polled', this.device.rpaths.join(', '))
        this.service.update(1003)
      })
      .on('changed', (rpath, body) => {
        if (Object.keys(body).length === 1) {
          if (body.state != null) {
            rpath += '/state'
            body = body.state
          } else if (body.config != null) {
            rpath += '/config'
            body = body.config
          }
        }
        this.debug('%s: changed: %j', rpath, body)
        this.service.update(1002)
      })
      .on('identify', this.identify)

    setImmediate(() => {
      this.debug('initialised')
      this.emit('initialised')
    })
  }
}

module.exports = Device
