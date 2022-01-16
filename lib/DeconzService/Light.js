// homebridge-deconz/lib/DeconzService/Sensor.js
// Copyright © 2022 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const homebridgeLib = require('homebridge-lib')
const Deconz = require('../Deconz')

const { dateToString } = Deconz.ApiClient
const { timeout } = homebridgeLib
const { xyToHsv, hsvToXy, ctToXy } = homebridgeLib.Colour

class Light extends homebridgeLib.ServiceDelegate {
  constructor (accessory, resource) {
    super(accessory, {
      id: resource.id,
      name: resource.body.name,
      subtype: resource.subtype,
      Service: accessory.Services.hap.Lightbulb
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

    this.debug('%s: capabilities: %j', this.resource.rpath, this.capabilities)

    this.targetState = {}
    this.deferrals = []

    this.addCharacteristicDelegate({
      key: 'on',
      Characteristic: this.Characteristics.hap.On,
      value: this.capabilities.on
        ? this.resource.body.state.on
        : this.resource.body.state.all_on,
      setter: async (value) => { return this.put({ on: value }) }
    }).on('didSet', (value, fromHomekit) => {
      this.checkAdaptiveLighting()
    })

    if (!this.capabilities.on) {
      this.addCharacteristicDelegate({
        key: 'anyOn',
        Characteristic: this.Characteristics.my.AnyOn,
        value: this.resource.body.state.any_on,
        setter: async (value) => { return this.put({ on: value }) }
      }).on('didSet', (value, fromHomekit) => {
        this.checkAdaptiveLighting()
      })
    }

    if (this.capabilities.bri) {
      this.brightnessDelegate = this.addCharacteristicDelegate({
        key: 'brightness',
        Characteristic: this.Characteristics.hap.Brightness,
        unit: '%',
        value: this.resource.body.state.bri,
        setter: async (value) => {
          const bri = Math.round(value * 254.0 / 100.0)
          return this.put({ bri: bri })
        }
      }).on('didSet', (value, fromHomekit) => {
        this.checkAdaptiveLighting()
      })

      this.addCharacteristicDelegate({
        key: 'brightnessChange',
        Characteristic: this.Characteristics.my.BrightnessChange,
        value: 0,
        setter: async (value) => {
          return this.put({ bri_inc: Math.round(value * 254.0 / 100.0) })
        }
      }).on('didSet', async () => {
        await timeout(this.platform.config.waitTimeReset)
        this.values.brightnessChange = 0
      })
      this.values.brightnessChange = 0
    }

    if (this.capabilities.ct || this.capabilities.xy || this.capabilities.hs) {
      this.addCharacteristicDelegate({
        key: 'colormode',
        value: this.resource.body.state.colormode
      })
    }

    if (this.capabilities.ct) {
      this.colorTemperatureDelegate = this.addCharacteristicDelegate({
        key: 'colorTemperature',
        Characteristic: this.Characteristics.hap.ColorTemperature,
        unit: ' mired',
        props: {
          minValue: this.capabilities.ctMin,
          maxValue: this.capabilities.ctMax
        },
        value: this.resource.body.state.ct,
        setter: async (value) => {
          const ct = Math.max(
            this.capabilities.ctMin, Math.min(value, this.capabilities.ctMax)
          )
          return this.put({ ct: ct })
        }
      }).on('didSet', (value, fromHomeKit) => {
        if (fromHomeKit) {
          this.values.activeTransitionCount = 0
        }
        if (
          this.capabilities.xy && !this.capabilities.computesXy &&
          this.values.colormode === 'ct'
        ) {
          const { h, s } = xyToHsv(ctToXy(value), this.capabilities.gamut)
          this.values.hue = h
          this.values.saturation = s
        }
      })

      if (this.capabilities.bri) {
        this.addCharacteristicDelegate({
          key: 'supportedTransitionConfiguration',
          Characteristic: this.Characteristics.hap
            .SupportedCharacteristicValueTransitionConfiguration,
          silent: true
        })
        this.addCharacteristicDelegate({
          key: 'transitionControl',
          Characteristic: this.Characteristics.hap
            .CharacteristicValueTransitionControl,
          silent: true,
          getter: async () => {
            await this.initAdaptiveLighting()
            return this.adaptiveLighting.generateControl()
          },
          setter: async (value) => {
            await this.initAdaptiveLighting()
            this.adaptiveLighting.parseControl(value)
            const response = this.adaptiveLighting.generateControlResponse()
            this.values.activeTransitionCount = 1
            return response
          }
        })
        this.addCharacteristicDelegate({
          key: 'activeTransitionCount',
          Characteristic: this.Characteristics.hap
            .CharacteristicValueActiveTransitionCount,
          value: 0
        }).on('didSet', (value) => {
          if (!value) {
            this.adaptiveLighting.deactivate()
          } else {
            this.checkAdaptiveLighting()
          }
        })
      }
    }

    if (this.capabilities.xy) {
      this.addCharacteristicDelegate({
        key: 'hue',
        Characteristic: this.Characteristics.hap.Hue,
        unit: '°',
        setter: async (value) => {
          const xy = hsvToXy(value, this.values.saturation, this.capabilities.gamut)
          return this.put({ xy: xy })
        }
      }).on('didSet', (value, fromHomekit) => {
        if (fromHomekit) {
          this.values.activeTransitionCount = 0
        }
      })
      this.addCharacteristicDelegate({
        key: 'saturation',
        Characteristic: this.Characteristics.hap.Saturation,
        unit: '%',
        setter: async (value) => {
          const xy = hsvToXy(this.values.hue, value, this.capabilities.gamut)
          return this.put({ xy: xy })
        }
      }).on('didSet', (value, fromHomekit) => {
        if (fromHomekit) {
          this.values.activeTransitionCount = 0
        }
      })
    } else if (this.capabilities.hs) {
      this.addCharacteristicDelegate({
        key: 'hue',
        Characteristic: this.Characteristics.hap.Hue,
        unit: '°',
        setter: async (value) => {
          const hue = Math.round(this.hk.hue * 65535.0 / 360.0)
          return this.put({ hue: hue })
        }
      }).on('didSet', (value, fromHomekit) => {
        if (fromHomekit) {
          this.values.activeTransitionCount = 0
        }
      })
      this.addCharacteristicDelegate({
        key: 'saturation',
        Characteristic: this.Characteristics.hap.Saturation,
        unit: '%',
        setter: async (value) => {
          const sat = Math.round(this.hk.sat * 254.0 / 100.0)
          return this.put({ sat: sat })
        }
      }).on('didSet', (value, fromHomekit) => {
        if (fromHomekit) {
          this.values.activeTransitionCount = 0
        }
      })
    }

    if (this.capabilities.colorLoop) {
      this.addCharacteristicDelegate({
        key: 'colorLoop',
        Characteristic: this.Characteristics.my.ColorLoop,
        setter: async (value) => {
          const effect = value ? 'colorloop' : 'none'
          const state = { effect: effect }
          if (value) {
            state.colorloopspeed = this.values.colorLoopSpeed
          }
          return this.put(state)
        }
      })
      this.addCharacteristicDelegate({
        key: 'colorLoopSpeed',
        Characteristic: this.Characteristics.my.ColorLoopSpeed,
        unit: 's',
        value: 25,
        setter: async (value) => {
          return this.put({ effect: 'colorloop', colorloopspeed: value })
        }
      })
    }

    this.addCharacteristicDelegate({
      key: 'lastSeen',
      Characteristic: this.Characteristics.my.LastSeen
    })

    this.addCharacteristicDelegate({
      key: 'statusFault',
      Characteristic: this.Characteristics.hap.StatusFault
    })

    this.settings = {
      brightnessAdjustment: 1,
      resetTimeout: this.platform.config.resetTimeout,
      waitTimeUpdate: this.platform.config.waitTimeUpdate,
      wallSwitch: false
    }

    this.update(this.resource.body)
  }

  update (body) {
    for (const key in body) {
      const value = body[key]
      switch (key) {
        case 'action':
          // Copied to `state` by `Resource` during polling.
          break
        case 'state':
          this.updateState(value)
          break
        case 'lastannounced':
          // this.values.lastBoot = dateToString(value)
          break
        case 'lastseen':
          this.values.lastSeen = dateToString(value)
          break
        case 'colorcapabilities':
        case 'ctmax':
        case 'ctmin':
        case 'devicemembership':
        case 'etag':
        case 'id':
        case 'lights':
        case 'hascolor':
        case 'manufacturername':
        case 'modelid':
        case 'name':
        case 'powerup':
        case 'scenes':
        case 'swversion':
        case 'type':
        case 'uniqueid':
          break
        default:
          this.warn('%s: unknown %s attribute', key, this.rtype)
          break
      }
    }
  }

  updateState (state) {
    for (const key in state) {
      const value = state[key]
      switch (key) {
        case 'all_on':
          this.values.on = value
          break
        case 'any_on':
          this.values.anyOn = value
          break
        case 'alert':
          break
        case 'bri':
          this.values.brightness = Math.round(value * 100.0 / 254.0)
          break
        case 'colormode':
          this.values.colormode = value
          break
        case 'ct':
          this.values.colorTemperature = value
          break
        case 'effect':
          break
        case 'hue':
          if (!this.capabilities.xy) {
            this.values.hue = value
          }
          break
        case 'on':
          this.values.on = value
          break
        case 'reachable':
          this.values.statusFault = value
            ? this.Characteristics.hap.StatusFault.NO_FAULT
            : this.Characteristics.hap.StatusFault.GENERAL_FAULT
          break
        case 'sat':
          if (!this.capabilities.xy) {
            this.values.hue = value
          }
          break
        case 'scene':
          break
        case 'xy':
          if (this.values.colormode !== 'ct' || this.capabilities.computesXy) {
            const { h, s } = xyToHsv(value, this.capabilities.gamut)
            this.values.hue = h
            this.values.saturation = s
          }
          break
        default:
          this.warn('state.%s: unknown %s attribute', key, this.rtype)
          break
      }
    }
  }

  async identify () {
    try {
      if (this.capabilities.alert) {
        if (this.capabilities.breathe) {
          await this.put({ alert: 'breathe' })
          await timeout(1500)
          return this.put({ alert: 'stop' })
        }
        return this.put({ alert: 'select' })
      }
    } catch (error) { this.warn(error) }
  }

  async initAdaptiveLighting () {
    if (this.adaptiveLighting == null) {
      this.adaptiveLighting = new homebridgeLib.AdaptiveLighting(
        this.brightnessDelegate, this.colorTemperatureDelegate
      )
      this.values.supportedTransitionConfiguration =
        this.adaptiveLighting.generateConfiguration()
      if (
        this.values.activeTransitionCount === 1 &&
        this.values.transitionControl != null
      ) {
        this.adaptiveLighting.parseControl(this.values.transitionControl)
      }
    }
  }

  async checkAdaptiveLighting () {
    if (this.adaptiveLighting == null || !this.values.on) {
      return
    }
    const ct = this.adaptiveLighting.getCt(
      this.values.brightness * this.settings.brightnessAdjustment
    )
    if (ct == null || ct === this.values.ct) {
      return
    }
    return this.put({ ct: ct })
  }

  // Collect changes into a combined request.
  async put (state) {
    return new Promise((resolve, reject) => {
      for (const key in state) {
        this.targetState[key] = state[key]
      }
      const d = { resolve: resolve, reject: reject }
      this.deferrals.push(d)
      if (this.updating) {
        return
      }
      this.updating = true
      if (this.settings.waitTimeUpdate > 0) {
        setTimeout(() => {
          this._put()
        }, this.settings.waitTimeUpdate)
      } else {
        this._put()
      }
    })
  }

  // Send the request (for the combined changes) to the gateway.
  async _put () {
    const targetState = this.targetState
    const deferrals = this.deferrals
    this.targetState = {}
    this.deferrals = []
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
    this.client.put(this.rpath, targetState).then((obj) => {
      this.recentlyUpdated = true
      for (const d of deferrals) {
        d.resolve(true)
      }
      setTimeout(() => {
        this.recentlyUpdated = false
      }, 500)
    }).catch((error) => {
      for (const d of deferrals) {
        d.reject(error)
      }
    })
  }
}

module.exports = Light
