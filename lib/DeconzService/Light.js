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
        : this.resource.body.state.all_on
    }).on('didSet', (value, fromHomeKit) => {
      if (fromHomeKit) {
        this.put({ on: value })
        this.updateAdaptiveLighting()
      }
    })

    if (!this.capabilities.on) {
      this.addCharacteristicDelegate({
        key: 'anyOn',
        Characteristic: this.Characteristics.my.AnyOn,
        value: this.resource.body.state.any_on
      }).on('didSet', (value, fromHomeKit) => {
        if (fromHomeKit) {
          this.put({ on: value })
          this.updateAdaptiveLighting()
        }
      })
    }

    if (this.capabilities.bri) {
      this.brightnessDelegate = this.addCharacteristicDelegate({
        key: 'brightness',
        Characteristic: this.Characteristics.hap.Brightness,
        unit: '%',
        value: this.resource.body.state.bri
      }).on('didSet', (value, fromHomeKit) => {
        if (fromHomeKit) {
          const bri = Math.round(value * 254.0 / 100.0)
          this.put({ bri: bri })
          this.updateAdaptiveLighting()
        }
      })

      this.addCharacteristicDelegate({
        key: 'brightnessChange',
        Characteristic: this.Characteristics.my.BrightnessChange,
        value: 0
      }).on('didSet', async (value) => {
        this.put({ bri_inc: Math.round(value * 254.0 / 100.0) })
        await timeout(this.platform.config.waitTimeReset)
        this.values.brightnessChange = 0
      })
      this.values.brightnessChange = 0
    }

    if (this.capabilities.ct || this.capabilities.xy || this.capabilities.hs) {
      this.addCharacteristicDelegate({
        key: 'colormode',
        value: this.resource.body.state.colormode,
        silent: true
      }).on('didSet', (value) => {
        this.resource.body.colormode = value
        if (value !== 'ct') {
          this.checkAdaptiveLighting()
        }
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
        value: this.resource.body.state.ct
      }).on('didSet', (value, fromHomeKit) => {
        this.checkAdaptiveLighting()
        const ct = Math.max(
          this.capabilities.ctMin, Math.min(value, this.capabilities.ctMax)
        )
        if (fromHomeKit) {
          this.put({ ct: ct })
          this.values.colormode = 'ct'
        }
        if (this.capabilities.xy && this.values.colormode === 'ct') {
          const { h, s } = xyToHsv(ctToXy(ct), this.capabilities.gamut)
          this.values.hue = h
          this.values.saturation = s
        }
      })
    }

    if (this.capabilities.xy) {
      this.addCharacteristicDelegate({
        key: 'hue',
        Characteristic: this.Characteristics.hap.Hue,
        unit: '°'
      }).on('didSet', (value, fromHomeKit) => {
        if (fromHomeKit) {
          const xy = hsvToXy(
            value, this.values.saturation, this.capabilities.gamut
          )
          this.put({ xy: xy })
          this.values.colormode = 'xy'
        }
      })
      this.addCharacteristicDelegate({
        key: 'saturation',
        Characteristic: this.Characteristics.hap.Saturation,
        unit: '%'
      }).on('didSet', (value, fromHomeKit) => {
        if (fromHomeKit) {
          const xy = hsvToXy(this.values.hue, value, this.capabilities.gamut)
          this.put({ xy: xy })
          this.values.colormode = 'xy'
        }
      })
    } else if (this.capabilities.hs) {
      this.addCharacteristicDelegate({
        key: 'hue',
        Characteristic: this.Characteristics.hap.Hue,
        unit: '°'
      }).on('didSet', (value, fromHomeKit) => {
        if (fromHomeKit) {
          const hue = Math.round(this.hk.hue * 65535.0 / 360.0)
          this.put({ hue: hue })
          this.values.colormode = 'hs'
        }
      })
      this.addCharacteristicDelegate({
        key: 'saturation',
        Characteristic: this.Characteristics.hap.Saturation,
        unit: '%'
      }).on('didSet', (value, fromHomeKit) => {
        if (fromHomeKit) {
          const sat = Math.round(this.hk.sat * 254.0 / 100.0)
          this.put({ sat: sat })
          this.values.colormode = 'hs'
        }
      })
    }

    if (this.capabilities.colorLoop) {
      this.addCharacteristicDelegate({
        key: 'colorLoop',
        Characteristic: this.Characteristics.my.ColorLoop
      }).on('didSet', (value, fromHomeKit) => {
        if (fromHomeKit) {
          const effect = value ? 'colorloop' : 'none'
          const state = { effect: effect }
          if (value) {
            state.colorloopspeed = this.values.colorLoopSpeed
          }
          this.put(state)
          this.values.colormode = 'hs'
        }
      })
      this.addCharacteristicDelegate({
        key: 'colorLoopSpeed',
        Characteristic: this.Characteristics.my.ColorLoopSpeed,
        unit: 's',
        value: 25
      }).on('didSet', (value, fromHomeKit) => {
        if (fromHomeKit) {
          const effect = 'colorloop'
          this.put({ effect: effect, colorloopspeed: value })
          this.values.colormode = 'hs'
        }
      })
    }

    this.addCharacteristicDelegate({
      key: 'lastSeen',
      Characteristic: this.Characteristics.my.LastSeen,
      silent: true
    })

    this.addCharacteristicDelegate({
      key: 'statusFault',
      Characteristic: this.Characteristics.hap.StatusFault
    })

    if (this.capabilities.bri && this.capabilities.ct && !this.capabilities.hs) {
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
          this.initAdaptiveLighting()
          return this.adaptiveLighting.generateControl()
        },
        setter: async (value) => {
          this.initAdaptiveLighting()
          const control = this.adaptiveLighting.parseControl(value)
          this.context.transitionControl = value
          const response = this.adaptiveLighting.generateControlResponse()
          const parsedResponse = this.adaptiveLighting.parseControl(response)
          this.vdebug(
            'Adaptive Lighting: control update: %j => %j',
            control, parsedResponse
          )
          this.values.activeTransitionCount = parsedResponse === '' ? 0 : 1
          return response
        }
      })
      this.addCharacteristicDelegate({
        key: 'activeTransitionCount',
        Characteristic: this.Characteristics.hap
          .CharacteristicValueActiveTransitionCount,
        silent: true,
        value: 0
      }).on('didSet', (value) => {
        this.log('Adaptive Lighting: %sabled', value > 0 ? 'en' : 'dis')
        if (value) {
          this.updateAdaptiveLighting()
        }
      })
      if (this.values.supportedTransitionConfiguration != null) {
        this.initAdaptiveLighting()
      }
    }

    this.settings = {
      brightnessAdjustment: 1,
      resetTimeout: this.platform.config.resetTimeout,
      waitTimeUpdate: this.platform.config.waitTimeUpdate,
      wallSwitch: false
    }
  }

  update (body) {
    if (this.updating) {
      return
    }
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
          this.resource.body.lastseen = value
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
    let updateAdaptiveLighting = false
    for (const key in state) {
      const value = state[key]
      this.resource.body.state[key] = value
      switch (key) {
        case 'all_on':
          this.values.on = value
          updateAdaptiveLighting = true
          break
        case 'any_on':
          this.values.anyOn = value
          updateAdaptiveLighting = true
          break
        case 'alert':
          break
        case 'bri':
          if (!this.recentlyUpdated) {
            this.values.brightness = Math.round(value * 100.0 / 254.0)
            updateAdaptiveLighting = true
          }
          break
        case 'colormode':
          this.values.colormode = value
          break
        case 'ct':
          if (!this.recentlyUpdated && this.values.colormode === 'ct') {
            this.values.colorTemperature = value
          }
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
          if (
            !this.recentlyUpdated &&
            (this.values.colormode !== 'ct' || this.capabilities.computesXy)
          ) {
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
    if (updateAdaptiveLighting) {
      this.updateAdaptiveLighting()
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

  initAdaptiveLighting () {
    if (this.adaptiveLighting == null) {
      this.adaptiveLighting = new homebridgeLib.AdaptiveLighting(
        this.brightnessDelegate, this.colorTemperatureDelegate
      )
      this.values.supportedTransitionConfiguration =
        this.adaptiveLighting.generateConfiguration()
      if (this.values.activeTransitionCount > 0) {
        const control = this.adaptiveLighting.parseControl(
          this.context.transitionControl
        )
        this.vdebug('Adaptive Lighting: restore control: %j', control)
        this.adaptiveLighting.parseControl(this.context.transitionControl)
      }
      this.log(
        'Adaptive Lighting: %sabled',
        this.values.activeTransitionCount > 0 ? 'en' : 'dis'
      )
    }
  }

  async updateAdaptiveLighting () {
    if (
      this.adaptiveLighting == null || // not supported
      this.values.activeTransitionCount === 0 || // disabled
      !this.values.on // light is off
    ) {
      return
    }
    const ct = this.adaptiveLighting.getCt(
      this.values.brightness * this.settings.brightnessAdjustment
    )
    if (ct == null) {
      this.warn('assertion failed')
      return
    }
    this.debug(
      '/%s/%d: adaptive lighting: {"state":{"ct": %d}}',
      this.rtype, this.rid, ct
    )
    if (this.values.colormode === 'ct' && ct === this.values.colorTemperature) {
      return
    }
    this.put({ ct: ct })
    this.fromAdaptiveLighting = true
    this.values.colormode = 'ct'
    if (ct !== this.values.colorTemperature) {
      this.values.colorTemperature = ct
    } else if (this.capabilities.xy) { // colormode changed
      const { h, s } = xyToHsv(ctToXy(ct), this.capabilities.gamut)
      this.values.hue = h
      this.values.saturation = s
    }
    this.fromAdaptiveLighting = false
  }

  checkAdaptiveLighting (key, value) {
    if (this.fromAdaptiveLighting) {
      return
    }
    this.adaptiveLighting.deactivate()
    this.values.activeTransitionCount = 0
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

module.exports = Light
