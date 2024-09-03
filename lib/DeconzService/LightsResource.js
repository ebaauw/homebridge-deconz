// homebridge-deconz/lib/DeconzService/LightsResource.js
// Copyright © 2022-2024 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

import { timeout } from 'homebridge-lib'

import { DeconzService } from '../DeconzService/index.js'

class LightsResource extends DeconzService {
  constructor (accessory, resource, params) {
    super(accessory, resource, params)
    this.stateKey = resource.rtype === 'groups' ? 'action' : 'state'
    this.statePath = '/' + this.stateKey

    this.updating = 0
    this.targetState = {}
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
    if (this.resource.body?.capabilities?.alerts?.includes('breathe')) {
      await this.put(this.statePath, { alert: 'breathe' })
      await timeout(1000)
      return this.put(this.statePath, { alert: 'finish' })
    }
    return this.put(this.statePath, { alert: 'select' })
  }

  // Collect state changes into a combined request.
  async putState (state) {
    for (const key in state) {
      this.resource.body[this.stateKey][key] = state[key]
      this.targetState[key] = state[key]
    }
    return this._putState()
  }

  // Send the request (for the combined state changes) to the gateway.
  async _putState () {
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
      if (this.resource.body?.capabilities?.transition_block) {
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
      await this.put(this.statePath, targetState)
      this.recentlyUpdated = true
      await timeout(500)
      this.recentlyUpdated = false
    } catch (error) { this.warn(error) }
  }
}

DeconzService.LightsResource = LightsResource
