// homebridge-deconz/lib/DeconzService/Switch.js
// Copyright © 2022 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const DeconzService = require('../DeconzService')

const hueTapMap = {
  34: 1002, // press 1
  16: 2002, // press 2
  17: 3002, // press 3
  18: 4002, // press 4
  100: 5002, // press 1 and 2
  101: 0, // release 1 and 2
  98: 6002, // press 3 and 4
  99: 0 // release 3 and 4
}

/**
  * @memberof DeconzService
  */
class Switch extends DeconzService.SensorsResource {
  constructor (accessory, resource, settings = {}) {
    super(accessory, {
      name: accessory.name,
      Service: accessory.Services.hap.ServiceLabel,
      primaryService: settings.primaryService
    })

    this.addCharacteristicDelegate({
      key: 'namespace',
      Characteristic: this.Characteristics.hap.ServiceLabelNamespace,
      value: resource.capabilities.namespace
    })
    this.addCharacteristicDelegates()

    this.buttonServices = {}
    this.lastUpdated = {}
    this.buttonEvent = {}
  }

  createButtonServices (resource, settings = { repeat: false }) {
    this.lastUpdated[resource.rpath] = ''
    this.buttonEvent[resource.rpath] = resource.body.state.buttonevent
    for (const i in resource.capabilities.buttons) {
      const { label, events, repeat } = resource.capabilities.buttons[i]
      this.buttonServices[i] = new DeconzService.Button(this.accessoryDelegate, {
        name: this.name + ' ' + label,
        button: Number(i),
        events: events,
        repeat: repeat && settings.repeat
      })
    }
  }

  updateState (state, rpath) {
    if (this.lastUpdated[rpath] === '') {
      this.lastUpdated[rpath] = state.lastupdated
    } else if (state.lastupdated !== this.lastUpdated[rpath]) {
      this.lastUpdated[rpath] = state.lastupdated
      const oldValue = this.buttonEvent[rpath]
      if (state.buttonevent != null) {
        this.buttonEvent[rpath] = state.buttonevent < 1000
          ? hueTapMap[state.buttonevent]
          : state.buttonevent
      }
      // TODO handle repeat
      this.updateButtonEvent(this.buttonEvent[rpath], oldValue, false)
    }
    super.updateState(state)
  }

  updateConfig (config) {
    // TODO handle change in devicemode
    super.updateConfig(config)
  }

  updateButtonEvent (value, oldValue, repeat) {
    const i = Math.floor(value / 1000)
    if (this.buttonServices[i] != null) {
      this.buttonServices[i].update(value, oldValue, repeat)
    }
  }
}

module.exports = Switch
