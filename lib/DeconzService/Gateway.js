// homebridge-deconz/lib/DeconzService/Gateway.js
// Copyright © 2022-2026 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

import { ServiceDelegate } from 'homebridge-lib/ServiceDelegate'

import { DeconzService } from './index.js'

/** Delegate class for a DeconzGateway service.
  * @extends ServiceDelegate
  * @memberof DeconzService
  */
class Gateway extends ServiceDelegate {
  constructor (gateway, params = {}) {
    params.Service = gateway.Services.my.DeconzGateway
    params.exposeConfiguredName = true
    super(gateway, params)
    this.gateway = gateway

    this.addCharacteristicDelegate({
      key: 'lastUpdated',
      Characteristic: this.Characteristics.my.LastUpdated,
      silent: true
    })

    this.addCharacteristicDelegate({
      key: 'statusActive',
      Characteristic: this.Characteristics.hap.StatusActive,
      value: true,
      silent: true
    })

    this.addCharacteristicDelegate({
      key: 'search',
      Characteristic: this.Characteristics.my.Search,
      value: false
    }).on('didSet', (value, fromHomeKit) => {
      if (fromHomeKit) {
        this.gateway.values.search = value
      }
    })

    this.addCharacteristicDelegate({
      key: 'transitionTime',
      Characteristic: this.Characteristics.my.TransitionTime,
      value: this.gateway.defaultTransitionTime
    })
    this.values.transitionTime = this.gateway.defaultTransitionTime
  }

  update (config) {
    this.values.expose = true
    this.values.lastUpdated = new Date().toString().slice(0, 24)
  }
}

DeconzService.Gateway = Gateway
