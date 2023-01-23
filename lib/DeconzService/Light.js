// homebridge-deconz/lib/DeconzService/Light.js
// Copyright © 2022 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const homebridgeLib = require('homebridge-lib')
const DeconzService = require('../DeconzService')

const { History } = homebridgeLib.ServiceDelegate
const { timeout } = homebridgeLib
const { xyToHsv, hsvToXy, ctToXy } = homebridgeLib.Colour

class Light extends DeconzService.LightsResource {
  constructor (accessory, resource, params = {}) {
    params.Service = accessory.Services.hap.Lightbulb
    super(accessory, resource, params)

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
        value: Math.round(this.resource.body.state.bri / 2.54)
      }).on('didSet', (value, fromHomeKit) => {
        if (fromHomeKit) {
          const bri = Math.round(value * 2.54)
          this.put({ bri })
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

    if (
      this.resource.body.config != null &&
      this.resource.body.config.color != null &&
      this.resource.body.config.color.execute_if_off != null
    ) {
      this.addCharacteristicDelegate({
        key: 'colorExecuteIfOff',
        value: this.resource.body.config.color.execute_if_off
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
        const ct = Math.max(
          this.capabilities.ctMin, Math.min(value, this.capabilities.ctMax)
        )
        if (fromHomeKit) {
          this.checkAdaptiveLighting()
          this.put({ ct })
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
          this.put({ xy })
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
          this.put({ xy })
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
          const hue = Math.round(this.values.hue * 65535.0 / 360.0)
          this.put({ hue })
          this.values.colormode = 'hs'
        }
      })
      this.addCharacteristicDelegate({
        key: 'saturation',
        Characteristic: this.Characteristics.hap.Saturation,
        unit: '%'
      }).on('didSet', (value, fromHomeKit) => {
        if (fromHomeKit) {
          const sat = Math.round(this.values.saturation * 254.0 / 100.0)
          this.put({ sat })
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
          const state = { effect }
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
          this.put({ effect, colorloopspeed: value })
          this.values.colormode = 'hs'
        }
      })
    }

    this.addCharacteristicDelegates()

    if (this.capabilities.bri && this.capabilities.ct && !this.capabilities.hs) {
      this.adaptiveLightingNotInitialised = true
      this.addCharacteristicDelegate({
        key: 'supportedTransitionConfiguration',
        Characteristic: this.Characteristics.hap
          .SupportedCharacteristicValueTransitionConfiguration,
        silent: true,
        getter: async () => {
          this.initAdaptiveLighting()
          return this.adaptiveLighting.generateConfiguration()
        }
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
            'adaptive lighting: control update: %j => %j',
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
        this.log('adaptive lighting: %sabled', value > 0 ? 'en' : 'dis')
        if (value) {
          this.updateAdaptiveLighting()
        }
      })
    }

    if (this.resource.rtype === 'groups') {
      this.addCharacteristicDelegate({
        key: 'exposeScenes',
        value: true
      })
      if (this.values.exposeScenes) {
        this.sceneServices = {}
        this.updateScenes(this.resource.body.scenes)
      }
    }

    if (this.capabilities.effects != null) {
      this.addCharacteristicDelegate({
        key: 'exposeEffects',
        value: true
      })
      if (this.values.exposeEffects) {
        this.exposeEffects()
      }
    }

    this.settings = {
      resetTimeout: this.platform.config.resetTimeout,
      waitTimeUpdate: this.platform.config.waitTimeUpdate,
      wallSwitch: false
    }
  }

  exposeEffects () {
    this.effectServices = {}
    this.addCharacteristicDelegate({
      key: 'effect',
      value: -1,
      silent: true
    }).on('didSet', (value) => {
      for (const i in this.capabilities.effects) {
        this.effectServices[i].values.on = value === i
      }
    })
    for (const id in this.capabilities.effects) {
      const effect = this.capabilities.effects[id]
      const service = new homebridgeLib.ServiceDelegate(this.accessoryDelegate, {
        name: this.resource.body.name + ' ' + effect,
        Service: this.Services.hap.Lightbulb,
        subtype: this.subtype + '-E' + id,
        exposeConfiguredName: true
      })
      service.addCharacteristicDelegate({
        key: 'on',
        Characteristic: this.Characteristics.hap.On
      }).on('didSet', (value, fromHomeKit) => {
        service.values.lastActivation =
          this.accessoryDelegate.historyService.lastActivationValue(History.now())
        if (fromHomeKit) {
          this.checkAdaptiveLighting()
          this.values.effect = value ? id : -1
          const newEffect = value
            ? effect.toLowerCase()
            : 'none'
          this.put({ effect: newEffect })
        }
      })
      service.addCharacteristicDelegate({
        key: 'index',
        Characteristic: this.Characteristics.hap.ServiceLabelIndex,
        value: Number(id) + 1
      })
      service.addCharacteristicDelegate({
        key: 'lastActivation',
        Characteristic: this.Characteristics.eve.LastActivation,
        silent: true
      })
      this.effectServices[id] = service

      this.characteristicDelegate('configuredName')
        .on('didSet', (value) => {
          for (const id in this.capabilities.effects) {
            this.effectServices[id].values.configuredName = value +
              ' ' + this.capabilities.effects[id]
          }
        })
    }
    // if (this.capabilities.effectSpeed) {
    //   this.addCharacteristicDelegate({
    //     key: 'effectSpeed',
    //     Characteristic: this.Characteristics.my.EffectSpeed,
    //     value: 50
    //   }).on('didSet', (value) => {
    //     this.setEffectSpeed(value)
    //   })
    //   this.hk.effectColours = []
    //   for (let i = 0; i <= 5; i++) {
    //     const service = new this.Service.Lightbulb(
    //       this.name + ' Effect Color ' + (i + 1), this.subtype + '-C' + i
    //     )
    //     service.addCharacteristicDelegate({
    //       key: 'on',
    //       Characteristic: this.Characteristics.hap.On,
    //       value: true
    //     }).on('didSet', (value) => {
    //       this.setEffectOn(i, value)
    //     })
    //     service.addCharacteristicDelegate({
    //       key: 'hue',
    //       Characteristic: this.Characteristics.hap.Hue,
    //       value: i * 60
    //     }).on('didSet', (value) => {
    //       this.setEffectHue(i, value)
    //     })
    //     service.addCharacteristicDelegate({
    //       key: 'saturation',
    //       Characteristic: this.Characteristics.hap.Saturation,
    //       value: 100
    //     }).on('didSet', (value) => {
    //       this.setEffectSat(i, value)
    //     })
    //     this.effectServices.push(service)
    //   }
    // }
    // this.checkEffect(this.obj.state.effect)
  }

  updateState (state) {
    this.initAdaptiveLighting()
    let updateAdaptiveLighting = false
    for (const key in state) {
      const value = state[key]
      // const oldValue = this.resource.body.state[key]
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
        case 'bri':
          if (!this.recentlyUpdated) {
            this.values.brightness = Math.round(value / 2.54)
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
          this.values.colorLoop = value === 'colorloop'
          if (this.capabilities.effects != null) {
            const effectName = value[0].toUpperCase() + value.slice(1)
            this.values.effect = '' + this.capabilities.effects.indexOf(effectName)
          }
          break
        case 'hue':
          if (!this.capabilities.xy) {
            this.values.hue = value
          }
          break
        case 'on':
          this.values.on = value
          break
        case 'sat':
          if (!this.capabilities.xy) {
            this.values.hue = value
          }
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
          break
      }
    }
    if (updateAdaptiveLighting) {
      this.updateAdaptiveLighting()
    }
    super.updateState(state)
  }

  updateConfig (config) {
    for (const key in config) {
      const value = config[key]
      switch (key) {
        case 'color':
          if (value.execute_if_off != null) {
            this.values.colorExecuteIfOff = value.execute_if_off
          }
          break
        default:
          break
      }
    }
  }

  updateScenes (scenes) {
    const sceneById = {}
    for (const scene of scenes) {
      sceneById[scene.id] = scene
      if (this.sceneServices[scene.id] == null) {
        const service = new homebridgeLib.ServiceDelegate(this.accessoryDelegate, {
          name: this.resource.body.name + ' ' + scene.name,
          Service: this.Services.hap.Lightbulb,
          subtype: this.subtype + '-S' + scene.id,
          exposeConfiguredName: true
        })
        service.addCharacteristicDelegate({
          key: 'on',
          Characteristic: this.Characteristics.hap.On,
          value: false
        }).on('didSet', async (value, fromHomeKit) => {
          this.checkAdaptiveLighting()
          if (fromHomeKit && value) {
            try {
              const path = this.resource.rpath + '/scenes/' + scene.id + '/recall'
              this.debug('PUT %s', path)
              await this.client.put(path)
            } catch (error) { this.error(error) }
            await timeout(this.platform.config.waitTimeReset)
            service.values.on = false
          }
        })
        service.addCharacteristicDelegate({
          key: 'index',
          Characteristic: this.Characteristics.hap.ServiceLabelIndex,
          value: Number(scene.id) + 1
        })
        this.sceneServices[scene.id] = service
      }
      this.sceneServices[scene.id].values.configuredName =
        this.resource.body.name + ' ' + scene.name
    }
    for (const id in this.scenesServices) {
      if (sceneById[id] == null) {
        this.scenesSerices[id].destroy()
        delete this.scenesService[id]
      }
    }
  }

  initAdaptiveLighting () {
    if (this.adaptiveLightingNotInitialised) {
      if (this.values.colorExecuteIfOff != null && !this.values.colorExecuteIfOff) {
        this.values.colorExecuteIfOff = true
      }
      delete this.adaptiveLightingNotInitialised
      this.adaptiveLighting = new homebridgeLib.AdaptiveLighting(
        this.brightnessDelegate, this.colorTemperatureDelegate
      )
      if (this.values.activeTransitionCount > 0) {
        const control = this.adaptiveLighting.parseControl(
          this.context.transitionControl
        )
        this.vdebug('adaptive lighting: restore control: %j', control)
        this.adaptiveLighting.parseControl(this.context.transitionControl)
      }
      this.log(
        'adaptive lighting: %sabled',
        this.values.activeTransitionCount > 0 ? 'en' : 'dis'
      )
    }
  }

  async updateAdaptiveLighting () {
    if (
      this.adaptiveLighting == null || // not supported
      this.values.activeTransitionCount === 0 || // disabled
      (!this.values.on && !this.values.colorExecuteIfOff)// light is off
    ) {
      return
    }
    const ct = this.adaptiveLighting.getCt(
      this.values.brightness * this.gateway.values.brightnessAdjustment
    )
    if (ct == null) {
      this.warn('adaptive lighting: cannot compute Color Temperature')
      return
    }
    if (this.values.colormode === 'ct' && ct === this.values.colorTemperature) {
      return
    }
    this.debug('adaptive lighting: set Color Temperature to %d mired', ct)
    this.put({ ct })
    this.fromAdaptiveLighting = true
    this.values.colormode = 'ct'
    if (ct !== this.values.colorTemperature) {
      this.values.colorTemperature = ct // should only do this when PUT succeeds
    } else if (this.capabilities.xy) { // colormode changed
      const { h, s } = xyToHsv(ctToXy(ct), this.capabilities.gamut)
      this.values.hue = h
      this.values.saturation = s
    }
    this.fromAdaptiveLighting = false
  }

  checkAdaptiveLighting (key, value) {
    if (this.adaptiveLighting == null || this.fromAdaptiveLighting) {
      return
    }
    this.adaptiveLighting.deactivate()
    this.values.activeTransitionCount = 0
  }
}

module.exports = Light
