// homebridge-deconz/lib/DeconzService/Contact.js
// Copyright © 2022 Erik Baauw. All rights reserved.
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

    this.addCharacteristicDelegate({
      key: 'timesOpened',
      Characteristic: this.Characteristics.eve.TimesOpened,
      value: 0
    })

    this.addCharacteristicDelegate({
      key: 'openDuration',
      Characteristic: this.Characteristics.eve.OpenDuration,
      value: 0
    })

    this.addCharacteristicDelegate({
      key: 'closedDuration',
      Characteristic: this.Characteristics.eve.ClosedDuration,
      value: 0
    })

    this.addCharacteristicDelegate({
      key: 'lastActivation',
      Characteristic: this.Characteristics.eve.LastActivation,
      silent: true
    })

    this.addCharacteristicDelegates({ noTampered: true })

    this.update(resource.body)
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
