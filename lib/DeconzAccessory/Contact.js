// homebridge-deconz/lib/DeconzAccessory/Contact.js
// Copyright © 2022 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const homebridgeLib = require('homebridge-lib')
const DeconzAccessory = require('../DeconzAccessory')

const { History } = homebridgeLib.ServiceDelegate

/** Delegate class for a HomeKit accessory corresponding to a contact sensor,
  * with Eve Door & Window history.
  * @extends DeconzAccessory
  * @memberof DeconzAccessory
  */
class Contact extends DeconzAccessory {
  /** Instantiate a contact sensor delegate.
    * @param {DeconzAccessory.Gateway} gateway - The gateway.
    * @param {Deconz.Device} device - The device.
    */
  constructor (gateway, device) {
    super(gateway, device, gateway.Accessory.Categories.SENSOR)

    this.identify()

    this.service = this.createService(device.resource, { primaryService: true })

    for (const subtype in device.resourceBySubtype) {
      const resource = device.resourceBySubtype[subtype]
      if (subtype === device.primary) {
        continue
      }
      this.createService(resource)
    }

    this.historyService = new History.Contact(this, {
      contactDelegate: this.service.characteristicDelegate('contact'),
      timesOpenedDelegate: this.service.characteristicDelegate('timesOpened'),
      lastActivationDelegate: this.service.characteristicDelegate('lastActivation')
    })

    this.createSettingsService()

    setImmediate(() => {
      this.debug('initialised')
      this.emit('initialised')
    })
  }
}

module.exports = Contact
