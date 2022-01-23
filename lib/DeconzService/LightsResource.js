// homebridge-deconz/lib/DeconzService/LightsResource.js
// Copyright © 2022 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const homebridgeLib = require('homebridge-lib')
const Deconz = require('../Deconz')

const { dateToString } = Deconz.ApiClient
const { timeout } = homebridgeLib

class LightsResource extends homebridgeLib.ServiceDelegate {
  constructor (accessory, resource, Service) {
    super(accessory, {
      id: resource.id,
      name: resource.body.name,
      subtype: resource.subtype,
      Service: Service
    })
    this.id = resource.id
    this.gateway = accessory.gateway
    this.client = accessory.client
    this.resource = resource
    this.rtype = resource.rtype
    this.rid = resource.rid
    this.rpath = resource.rpath +
      (resource.rtype === 'groups' ? '/action' : '/state')
    this.capabilities = resource.capabilities

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

  update (body) {
    if (this.updating) {
      return
    }
    if (body.lastseen != null) {
      this.values.lastSeen = dateToString(body.lastseen)
    }
    if (body.state != null) {
      this.updateState(body.state)
    }
  }

  updateState (state) {
    if (state.reachable != null) {
      this.values.statusFault = state.reachable
        ? this.Characteristics.hap.StatusFault.NO_FAULT
        : this.Characteristics.hap.StatusFault.GENERAL_FAULT
    }
  }

  async identify () {
    try {
      if (this.capabilities.alert) {
        if (this.capabilities.breathe) {
          await this.client.put({ alert: 'breathe' })
          await timeout(1500)
          return this.client.put({ alert: 'stop' })
        }
        return this.put({ alert: 'select' })
      }
    } catch (error) {
      if (!(error instanceof Deconz.ApiClient.HttpError)) {
        this.warn(error)
      }
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
      if (this.settings.waitTimeUpdate > 0) {
        await timeout(this.settings.waitTimeUpdate)
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
      if (!(error instanceof Deconz.ApiClient.HttpError)) {
        this.warn(error)
      }
    }
  }
}

module.exports = LightsResource
