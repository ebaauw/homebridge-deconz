// homebridge-deconz/lib/DeconzService/Schedule.js
// Copyright © 2022-2025 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

import { ServiceDelegate } from 'homebridge-lib/ServiceDelegate'

import { ApiClient } from 'hb-deconz-tools/ApiClient'

import { DeconzService } from '../DeconzService/index.js'

const { HttpError } = ApiClient

/**
  * @memberof DeconzService
  */
class Schedule extends ServiceDelegate {
  constructor (accessory, rid, body) {
    super(accessory, {
      id: accessory.gateway.id + '-T' + rid,
      name: body.name,
      Service: accessory.Services.my.Resource,
      subtype: 'T' + rid,
      exposeConfiguredName: true
    })
    this.id = accessory.gateway.id + '-T' + rid
    this.gateway = accessory.gateway
    this.accessory = accessory
    this.client = accessory.client
    this.rtype = 'schedules'
    this.rid = rid
    this.rpath = '/' + this.rtype + '/' + this.rid

    this.addCharacteristicDelegate({
      key: 'enabled',
      Characteristic: this.Characteristics.my.Enabled
    }).on('didSet', async (value, fromHomeKit) => {
      await this.put({ status: value ? 'enabled' : 'disabled' })
      this.values.statusActive = value
    })

    this.addCharacteristicDelegate({
      key: 'statusActive',
      Characteristic: this.Characteristics.hap.StatusActive
    })

    // this.addCharacteristicDelegate({
    //   key: 'index',
    //   Characteristic: this.Characteristics.hap.ServiceLabelIndex,
    //   value: rid
    // })
  }

  update (body) {
    this.values.enabled = body.status === 'enabled'
    this.values.statusActive = this.values.enabled
  }

  async put (body) {
    try {
      await this.client.put(this.rpath, body)
    } catch (error) {
      if (!(error instanceof HttpError)) {
        this.warn(error)
      }
    }
  }
}

DeconzService.Schedule = Schedule
