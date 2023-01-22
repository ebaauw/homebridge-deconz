// homebridge-deconz/lib/DeconzService/Status.js
// Copyright © 2022 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const DeconzService = require('../DeconzService')

/**
  * @memberof DeconzService
  */
class Status extends DeconzService.SensorsResource {
  constructor (accessory, resource, params = {}) {
    params.Service = accessory.Services.my.Status
    super(accessory, resource, params)

    if (resource.capabilities.readonly) {
      this.addCharacteristicDelegate({
        key: 'status',
        Characteristic: this.Characteristics.my.Status,
        props: {
          perms: [
            this.Characteristic.Perms.READ, this.Characteristic.Perms.NOTIFY
          ]
        }
      })
    } else {
      this.addCharacteristicDelegate({
        key: 'status',
        Characteristic: this.Characteristics.my.Status,
        props: resource.capabilities.props
      }).on('didSet', async (value, fromHomeKit) => {
        if (fromHomeKit) {
          await this.put('/state', { status: value })
        }
      })
    }

    this.addCharacteristicDelegates()

    this.update(resource.body, resource.rpath)
  }

  updateState (state) {
    if (state.status != null) {
      this.values.status = state.status
    }
    super.updateState(state)
  }
}

module.exports = Status
