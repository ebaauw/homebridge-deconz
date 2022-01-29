// homebridge-deconz/lib/DeconzService/LightsResource.js
// Copyright © 2022 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const homebridgeLib = require('homebridge-lib')
const Deconz = require('../Deconz')
const DeconzService = require('../DeconzService')

const { HttpError } = Deconz.ApiClient
const { timeout } = homebridgeLib

class LightsResource extends DeconzService {
  constructor (accessory, resource, params) {
    super(accessory, resource, params)
    this.rpath += resource.rtype === 'groups' ? '/action' : '/state'

    this.targetState = {}
    this.deferrals = []
  }

  addCharacteristicDelegates (params = {}) {
    this.addCharacteristicDelegate({
      key: 'lastSeen',
      Characteristic: this.Characteristics.my.LastSeen,
      silent: true
    })

    this.addCharacteristicDelegate({
      key: 'statusFault',
      Characteristic: this.Characteristics.hap.StatusFault
    })
  }

  updateState (state) {
    if (state.reachable != null) {
      this.values.statusFault = state.reachable
        ? this.Characteristics.hap.StatusFault.NO_FAULT
        : this.Characteristics.hap.StatusFault.GENERAL_FAULT
    }
  }

  async identify () {
    if (this.capabilities.alert) {
      if (this.capabilities.breathe) {
        await this.client.put(this.rpath, { alert: 'breathe' })
        await timeout(1500)
        await this.client.put(this.rpath, { alert: 'stop' })
      }
      await this.put(this.rpath, { alert: 'select' })
    }
  }

  // Collect changes into a combined request.
  put (state) {
    for (const key in state) {
      this.resource.body.state[key] = state[key]
      this.targetState[key] = state[key]
    }
    this._put()
  }

  // Send the request (for the combined changes) to the gateway.
  async _put () {
    try {
      if (this.updating) {
        return
      }
      this.updating = true
      if (this.platform.config.waitTimeUpdate > 0) {
        await timeout(this.platform.config.waitTimeUpdate)
      }
      const targetState = this.targetState
      this.targetState = {}
      this.updating = false
      if (
        this.gateway.transitionTime !== this.gateway.defaultTransitionTime &&
        targetState.transitiontime === undefined
      ) {
        targetState.transitiontime = this.gateway.transitionTime * 10
        this.gateway.resetTransitionTime()
      }
      if (this.capabilities.noTransition) {
        if (
          (
            targetState.on != null || targetState.bri != null ||
            targetState.bri_inc != null
          ) && (
            targetState.xy != null || targetState.ct != null ||
            targetState.hue != null || targetState.sat != null ||
            targetState.effect != null
          )
        ) {
          targetState.transitiontime = 0
        }
      }
      this.debug('PUT %s %j', this.rpath, targetState)
      await this.client.put(this.rpath, targetState)
      this.recentlyUpdated = true
      await timeout(500)
      this.recentlyUpdated = false
    } catch (error) {
      if (!(error instanceof HttpError)) {
        this.warn(error)
      }
    }
  }
}

module.exports = LightsResource
