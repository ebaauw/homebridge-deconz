// homebridge-deconz/lib/DeconzService/LightsResource.js
// Copyright© 2022-2023 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const { timeout } = require('homebridge-lib')
const { ApiClient } = require('hb-deconz-tools')
const DeconzService = require('../DeconzService')

const { HttpError } = ApiClient

class LightsResource extends DeconzService {
  constructor (accessory, resource, params) {
    super(accessory, resource, params)
    this.stateKey = resource.rtype === 'groups' ? 'action' : 'state'
    this.rpathState = this.rpath + '/' + this.stateKey

    this.updating = 0
    this.targetState = {}
    this.deferrals = []
  }

  addCharacteristicDelegates (params = {}) {
    if (this.resource.rtype !== 'groups') {
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
  }

  updateState (state) {
    if (state.reachable != null) {
      this.values.statusFault = state.reachable
        ? this.Characteristics.hap.StatusFault.NO_FAULT
        : this.Characteristics.hap.StatusFault.GENERAL_FAULT
    }
  }

  updateConfig (config) {
  }

  async identify () {
    if (this.capabilities.alert) {
      if (this.capabilities.breathe) {
        await this.put({ alert: 'breathe' })
        await timeout(1000)
        await this.put({ alert: 'stop' })
      } else {
        await this.put({ alert: 'select' })
      }
    }
  }

  // Collect changes into a combined request.
  async put (state) {
    for (const key in state) {
      this.resource.body[this.stateKey][key] = state[key]
      this.targetState[key] = state[key]
    }
    return this._put()
  }

  // Send the request (for the combined changes) to the gateway.
  async _put () {
    try {
      if (this.platform.config.waitTimeUpdate > 0) {
        this.updating++
        await timeout(this.platform.config.waitTimeUpdate)
        if (--this.updating > 0) {
          return
        }
      }
      const targetState = this.targetState
      this.targetState = {}
      if (
        this.gateway.transitionTime !== this.gateway.defaultTransitionTime &&
        targetState.transitiontime === undefined
      ) {
        targetState.transitiontime = this.gateway.transitionTime * 10
        this.gateway.resetTransitionTime()
      }
      if (this.capabilities.transition_block) {
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
      this.debug('PUT %s %j', this.rpathState, targetState)
      await this.client.put(this.rpathState, targetState)
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
