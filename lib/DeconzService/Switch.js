// homebridge-deconz/lib/DeconzService/Switch.js
// Copyright © 2022 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const DeconzService = require('../DeconzService')

/**
  * @memberof DeconzService
  */
class Switch extends DeconzService.SensorsResource {
  constructor (accessory, resource, params = {}) {
    params.Service = accessory.Services.hap.ServiceLabel
    super(accessory, resource, params)

    this.addCharacteristicDelegate({
      key: 'namespace',
      Characteristic: this.Characteristics.hap.ServiceLabelNamespace,
      value: resource.capabilities.namespace
    })

    this.addCharacteristicDelegates({ noLastUpdated: true })

    this.buttonResources = {}
    this.buttonServices = {}
    this.hasRepeat = false
  }

  createButtonServices (resource) {
    this.buttonResources[resource.rpath] = {
      buttonEvent: resource.body.state.buttonevent,
      lastUpdated: '',
      toButtonEvent: resource.capabilities.toButtonEvent
    }
    for (const i in resource.capabilities.buttons) {
      const { label, events, hasRepeat } = resource.capabilities.buttons[i]
      if (hasRepeat) {
        this.hasRepeat = hasRepeat
      }
      this.buttonServices[i] = new DeconzService.Button(this.accessoryDelegate, {
        name: this.name + ' ' + label,
        button: Number(i),
        events: events,
        hasRepeat: hasRepeat
      })
    }
  }

  updateState (state, rpath) {
    const buttonResource = this.buttonResources[rpath]
    if (buttonResource.lastUpdated === '') {
      buttonResource.lastUpdated = state.lastupdated
    } else if (
      state.lastupdated != null &&
      state.lastupdated !== buttonResource.lastUpdated
    ) {
      buttonResource.lastUpdated = state.lastupdated
      const oldValue = buttonResource.buttonEvent
      if (state.buttonevent != null) {
        buttonResource.buttonEvent = buttonResource.toButtonEvent == null
          ? state.buttonevent
          : buttonResource.toButtonEvent(state.buttonevent)
      }
      // TODO handle repeat
      this.updateButtonEvent(
        buttonResource.buttonEvent, oldValue,
        this.accessoryDelegate.settingsService.values.repeat
      )
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

  async identify () {
    this.debug('hasRepeat: %j', this.hasRepeat)
    return super.identify()
  }
}

module.exports = Switch
