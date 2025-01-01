// homebridge-deconz/lib/DeconzAccessory/WarningDevice.js
// Copyright © 2022-2025 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

import { ServiceDelegate } from 'homebridge-lib/ServiceDelegate'
import 'homebridge-lib/ServiceDelegate/History'

import { DeconzAccessory } from '../DeconzAccessory/index.js'

/** Delegate class for a HomeKit accessory, corresponding to a light device
  * or groups resource.
  * @extends DeconzAccessory
  * @memberof DeconzAccessory
  */
class WarningDevice extends DeconzAccessory {
  /** Instantiate a delegate for an accessory corresponding to a device.
    * @param {DeconzAccessory.Gateway} gateway - The gateway.
    * @param {Deconz.Device} device - The device.
    */
  constructor (gateway, device, settings = {}) {
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

    const params = {}
    if (this.servicesByServiceName.WarningDevice?.length === 1) {
      params.onDelegate = this.service.characteristicDelegate('on')
      params.lastOnDelegate = this.service.addCharacteristicDelegate({
        key: 'lastActivation',
        Characteristic: this.Characteristics.eve.LastActivation,
        silent: true
      })
    }
    if (this.servicesByServiceName.Temperature?.length === 1) {
      const service = this.servicesByServiceName.Temperature[0]
      params.temperatureDelegate = service.characteristicDelegate('temperature')
    }
    if (Object.keys(params).length > 0) {
      this.historyService = new ServiceDelegate.History(this, params)
    }

    setImmediate(() => {
      this.debug('initialised')
      this.emit('initialised')
    })
  }
}

DeconzAccessory.WarningDevice = WarningDevice
