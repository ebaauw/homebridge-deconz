// homebridge-deconz/lib/DeconzService/Contact.js
// Copyright © 2022-2024 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const DeconzService = require('../DeconzService')

/**
  * @memberof DeconzService
  */
class Contact extends DeconzService.SensorsResource {
  constructor (accessory, resource, params = {}) {
    params.Service = accessory.Services.hap.ContactSensor
    super(accessory, resource, params)

    this.addCharacteristicDelegate({
      key: 'contact',
      Characteristic: this.Characteristics.hap.ContactSensorState
    })

    // With _Status Tapered_ Eve thinks the _Door Sensor_ is an Eve Windows Guard
    // (instead of an Eve Door & Window) and won't display it.
    this.addCharacteristicDelegates({ noTampered: true })

    this.update(resource.body, resource.rpath)
  }

  updateState (state) {
    if (state.open != null) {
      this.values.contact = state.open
        ? this.Characteristics.hap.ContactSensorState.CONTACT_NOT_DETECTED
        : this.Characteristics.hap.ContactSensorState.CONTACT_DETECTED
    }
    super.updateState(state)
  }
}

module.exports = Contact
