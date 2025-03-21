// homebridge-deconz/lib/DeconzService/Label.js
// Copyright © 2022-2025 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

import { DeconzService } from '../DeconzService/index.js'
import '../DeconzService/SensorsResource.js'

/**
  * @memberof DeconzService
  */
class Label extends DeconzService.SensorsResource {
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
    if (resource.body.type.endsWith('Switch')) {
      this.buttonResources[resource.rpath] = {
        buttonEvent: resource.body.state.buttonevent,
        lastUpdated: new Date(),
        toButtonEvent: resource.capabilities.toButtonEvent
      }
    } else if (resource.body.type.endsWith('RelativeRotary')) {
      const keys = Object.keys(resource.capabilities.buttons)
      this.buttonResources[resource.rpath] = {
        expectedRotation: resource.body.state.expectedrotation,
        lastUpdated: new Date(),
        right: keys[0],
        left: keys[1]
      }
    } else if (resource.body.type.endsWith('AncillaryControl')) {
      this.buttonResources[resource.rpath] = {
        buttonEvent: resource.body.state.action,
        lastUpdated: new Date(),
        toButtonEvent: resource.capabilities.toButtonEvent
      }
    }
    for (const i in resource.capabilities.buttons) {
      const { label, events, hasRepeat } = resource.capabilities.buttons[i]
      if (hasRepeat) {
        this.hasRepeat = hasRepeat
      }
      this.buttonServices[i] = new DeconzService.Button(this.accessoryDelegate, {
        name: this.name + ' ' + label,
        button: Number(i),
        events,
        hasRepeat
      })
    }
  }

  updateState (state, rpath) {
    const buttonResource = this.buttonResources[rpath]
    if (buttonResource == null) {
      this.log('%s: resource deleted', rpath)
      this.gateway.reExposeAccessory(this.accessory.id)
      return
    }
    const lastUpdated = new Date(state.lastupdated + 'Z')
    if (lastUpdated > buttonResource.lastUpdated) {
      buttonResource.lastUpdated = lastUpdated
      if (buttonResource.buttonEvent !== undefined) {
        const oldValue = buttonResource.buttonEvent
        if (state.buttonevent != null) {
          buttonResource.buttonEvent = buttonResource.toButtonEvent == null
            ? state.buttonevent
            : buttonResource.toButtonEvent(state.buttonevent)
        } else if (state.action != null) {
          buttonResource.buttonEvent = buttonResource.toButtonEvent(state.action)
        }
        // TODO handle repeat
        const i = Math.floor(buttonResource.buttonEvent / 1000)
        this.buttonServices[i]?.update(
          buttonResource.buttonEvent, oldValue,
          false // this.accessoryDelegate.settingsService.values.repeat
        )
      } else {
        if (state.expectedrotation != null) {
          buttonResource.expectedRotation = state.expectedrotation
        }
        const i = buttonResource.expectedRotation >= 0
          ? buttonResource.right
          : buttonResource.left
        this.buttonServices[i]?.updateRotation()
      }
    }
    super.updateState(state)
  }

  updateConfig (config) {
    // TODO handle change in devicemode
    super.updateConfig(config)
  }

  async identify () {
    this.debug('hasRepeat: %j', this.hasRepeat)
    return super.identify()
  }
}

DeconzService.Label = Label
