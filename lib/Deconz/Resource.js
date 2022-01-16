// homebridge-deconz/lib/Deconz/Resource.js
// Copyright © 2022 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const homebridgeLib = require('homebridge-lib')

const { toInstance, toInt, toObject, toString } = homebridgeLib.OptionParser
const { defaultGamut } = homebridgeLib.Colour

const DeconzAccessory = require('../DeconzAccessory')

const rtypes = ['lights', 'sensors', 'groups']

// From low to high.
const sensorsPrios = [
  'Power',
  'Consumption',
  'Switch',
  'AirQuality',
  'Pressure',
  'Humidiy',
  'Temperature',
  'LightLevel',
  'Presence',
  'OpenClose',
  'Thermostat'
]

// =============================================================================

// See: http://www.developers.meethue.com/documentation/supported-lights

const hueGamutType = { // Color gamut per light model.
  A: { // Color Lights
    r: [0.7040, 0.2960],
    g: [0.2151, 0.7106],
    b: [0.1380, 0.0800]
  },
  B: { // Extended Color Lights
    r: [0.6750, 0.3220],
    g: [0.4090, 0.5180],
    b: [0.1670, 0.0400]
  },
  C: { // next gen Extended Color Lights
    r: [0.6920, 0.3080],
    g: [0.1700, 0.7000],
    b: [0.1530, 0.0480]
  }
}

const hueGamutTypeByModel = {
  LCT001: 'B', // Hue bulb A19
  LCT002: 'B', // Hue Spot BR30
  LCT003: 'B', // Hue Spot GU10
  LCT007: 'B', // Hue bulb A19
  LCT010: 'C', // Hue bulb A19
  LCT011: 'C', // Hue BR30
  LCT012: 'C', // Hue Color Candle
  LCT014: 'C', // Hue bulb A19
  LCT015: 'C', // Hue bulb A19
  LCT016: 'C', // Hue bulb A19
  LLC005: 'A', // Living Colors Gen3 Bloom, Aura
  LLC006: 'A', // Living Colors Gen3 Iris
  LLC007: 'A', // Living Colors Gen3 Bloom, Aura
  LLC010: 'A', // Hue Living Colors Iris
  LLC011: 'A', // Hue Living Colors Bloom
  LLC012: 'A', // Hue Living Colors Bloom
  LLC013: 'A', // Disney Living Colors
  LLC014: 'A', // Living Colors Gen3 Bloom, Aura
  LLC020: 'C', // Hue Go
  LLM001: 'B', // Color Light Module
  LST001: 'A', // Hue LightStrips
  LST002: 'C' // Hue LightStrips Plus
}

/** Delegate class for a resource on a deCONZ gateway.
  *
  * @memberof Deconz
  */
class Resource {
  /** Parse the `uniqueid` in the resource body of a resource for a Zigbee device.
    * @param {string} uniqueid - The `uniqueid`.
    * @return {object} The Zigbee `mac`, `endpoint`, and `cluster`.
    */
  static parseUniqueid (uniqueid) {
    toString('uniqueid', uniqueid, true)
    const a = uniqueid.replace(/:/g, '').toUpperCase().split('-')
    return {
      mac: a.length > 0 ? a[0] : null,
      endpoint: a.length > 1 ? a[1] : null,
      cluster: a.length > 2 ? a[2] : null
    }
  }

  /** Create a new instance of a delegate of a resource.
    *
    * @param {DeconzAccessory.Gateway} gateway - The gateway.
    * @param {string} rtype - The resource type of the resource:
    * `groups`, `lights`, or `sensors`.
    * @param {integer} rid - The resource ID of the resource.
    * @param {object} body - The body of the resource.
    */
  constructor (gateway, rtype, rid, body) {
    toInstance('gateway', gateway, DeconzAccessory.Gateway)

    /** The resource type of the resource: `groups`, `lights`, or `sensors`.
      * @type {string}
      */
    this.rtype = toString('rtype', rtype, true)
    if (!(rtypes.includes(rtype))) {
      throw new RangeError(`rtype: ${rtype}: not a valid resource type`)
    }

    /** The resource ID of the resource.
      * @type {integer}
      */
    this.rid = toInt('rid', rid)

    /** The body of the resource.
      * @type {object}
      */
    this.body = toObject('body', body)
    toString('body.name', body.name, true)
    toString('body.type', body.type, true)

    if (
      this.rtype === 'lights' ||
      (this.rtype === 'sensors' && this.body.type.startsWith('Z'))
    ) {
      const { mac, endpoint, cluster } = Resource.parseUniqueid(body.uniqueid)

      /** The device ID.
        *
        * For Zigbee devices, the device ID is based on the Zigbee mac address
        * of the device, from the `uniqueid` in the body of the resource.
        * For virtual devices, the device ID is based on the Zigbee mac address of
        * the gateway, and on the resource type and resource ID of the resource.
        * The UUID of the corresponding HomeKit accessory is based on the device ID.
        * @type {string}
        */
      this.id = mac

      /** The subtype of the corresponding HomeKit service.
        *
        * For Zigbee devices, the subtype is based on the Zigbee endpoint and
        * cluster, from the `uniqueid` in the body of the resource.
        * For virtual devices, the subtype is based on the resource type and
        * resource ID.
        * @type {string}
        */
      this.subtype = endpoint + (cluster == null ? '' : '-' + cluster)

      /** Zigbee device vs virtual device.
        *
        * Derived from the resource type and, for `sensors`, on the `type` in the
        * resource body.
        * @type {boolean}
        */
      this.zigbee = true
    } else {
      this.subtype = '-' + rtype[0].toUpperCase() + rid
      this.id = gateway.id + this.subtype
      this.zigbee = false
    }

    /** The associated Homekit _Manufacturer_.
      *
      * For Zigbee devices, this is the sanitised `manufacturername` in the
      * resource body.
      * For virtual devices, this is the _Manufacturer_ for the gateway.
      * @type {string}
      */
    this.manufacturer = this.zigbee
      ? body.manufacturername
      : gateway.values.manufacturer

    /** The associated HomeKit _Model_.
      *
      * For Zigbee devices, this is the sanitised `modelid` in the
      * resource body.
      * For virtual devices, this is the `type` in the resource body.
      * @type {string}
      */
    this.model = this.zigbee ? body.modelid : body.type

    /** The associated HomeKit _Firmware Version_.
      *
      * For Zigbee devices, this is the sanitised `swversion` in the
      * resource body.
      * For virtual devices, this is the _Firmware Version_ for the gateway.
      */
    this.firmware = this.zigbee
      ? body.swversion == null ? '0.0.0' : body.swversion
      : gateway.values.software

    switch (this.serviceName) {
      case 'Light': {
        if (body.action != null) {
          Object.assign(body.state, body.action)
          delete body.state.on
        }
        this.capabilities = {
          on: body.state.on !== undefined,
          bri: body.state.bri !== undefined,
          ct: body.state.ct !== undefined,
          ctMax: (body.ctmax != null && body.ctmax !== 0 && body.ctmax !== 65535)
            ? body.ctmax
            : 500,
          ctMin: (body.ctmin != null && body.ctmin !== 0)
            ? body.ctmin
            : 153,
          xy: body.state.xy !== undefined,
          gamut: defaultGamut,
          alert: body.state.alert !== undefined,
          colorLoop: body.state.effect !== undefined
        }
        break
      }
      case 'WarningDevice':
        this.capabilities = {}
        break
      case 'WindowCovering':
        this.capabilities = {}
        break
      default:
        this.capabilities = {}
        break
    }

    const f = 'patch' + this.serviceName
    if (typeof this[f] === 'function') {
      this[f](gateway)
    }
  }

  /** The priority of the resource, when determining the primary resource for a
    * device.
    * @type {integer}
    */
  get prio () {
    if (this.rtype === 'groups') return -1
    if (this.rtype === 'lights') return this.subtype
    return sensorsPrios.indexOf(this.type)
  }

  /** The resource path of the resource, e.g. `/lights/1`.
    *
    * This is derived from the resource type and resource ID.
    * @type {string}
    */
  get rpath () { return '/' + this.rtype + '/' + this.rid }

  /** The name of the {@link DeconzService} subclass of the delegate of the
    * corresponding HomeKit service, or `null` for unsupported and unknown
    * resources.
    *
    * This is derived from the resource type and`type` in the resource body.
    * @type {string}
    */
  get serviceName () {
    if (this.rtype === 'groups') {
      return 'Light'
    } else if (this.rtype === 'lights') {
      switch (this.body.type) {
        case 'Color dimmable light': return 'Light'
        case 'Color light': return 'Light'
        case 'Color temperature light': return 'Light'
        case 'Dimmable light': return 'Light'
        case 'Dimmable plug-in unit': return 'Light'
        case 'Extended color light': return 'Light'
        // case 'Consumption awareness device': return null
        case 'Dimmer switch': return 'Light'
        case 'Level control switch': return 'Light'
        // case 'Level controllable output': return null
        // case 'Door Lock': return null
        // case 'Door Lock Unit': return null
        case 'Fan': return 'Light'
        case 'On/Off light switch': return 'Light'
        case 'On/Off light': return 'Light'
        case 'On/Off output': return 'Light'
        case 'On/Off plug-in unit': return 'Light'
        case 'Smart plug': return 'Light'
        case 'Configuration tool': return ''
        case 'Range extender': return ''
        case 'Warning device': return 'WarningDevice'
        case 'Window covering controller': return 'WindowCovering'
        case 'Window covering device': return 'WindowCovering'
        default: return null
      }
    } else { // (this.rtype === 'sensors')
      switch (this.body.type) {
        case 'ZHAAirQuality':
        case 'CLIPAirQuality': return 'AirQuality'
        case 'ZHAAlarm':
        case 'CLIPAlarm': return 'Alarm'
        case 'ZHABattery':
        case 'CLIPBattery': return 'Battery'
        case 'ZHACarbonMonoxide':
        case 'CLIPCarbonMonoxide': return 'CarbonMonoxide'
        case 'ZHAConsumption':
        case 'CLIPConsumption': return 'Consumption'
        // case 'ZHADoorLock':
        // case 'CLIPDoorLock': return null
        case 'Daylight': return 'Daylight'
        case 'ZHAFire':
        case 'CLIPFire': return 'Fire'
        case 'CLIPGenericFlag': return 'Flag'
        case 'CLIPGenericStatus': return 'Status'
        case 'ZHAHumidity':
        case 'CLIPHumidity': return 'Humidity'
        case 'ZHALightLevel':
        case 'CLIPLightLevel': return 'LightLevel'
        // case 'ZHAMoisture':
        // case 'CLIPMoisture': return null
        case 'ZHAOpenClose':
        case 'CLIPOpenClose': return 'OpenClose'
        case 'ZHAPower':
        case 'CLIPPower': return 'Power'
        case 'ZHAPresence':
        case 'CLIPPresence': return 'Presence'
        case 'ZHAPressure':
        case 'CLIPPressure': return 'Pressure'
        case 'ZHASpectral': return ''
        case 'ZGPSwitch':
        case 'ZHASwitch': return 'Switch'
        case 'CLIPSwitch': return ''
        case 'ZHATemperature':
        case 'CLIPTemperature': return 'Temperature'
        case 'ZHAThermostat':
        case 'CLIPThermostat': return 'Thermostat'
        case 'ZHATime':
        case 'CLIPTime': return ''
        case 'ZHAVibration':
        case 'CLIPVibration': return 'Presence'
        case 'ZHAWater':
        case 'CLIPWater': return 'Water'
        default: return null
      }
    }
  }

  /** Patch a resource corresponding to a `Light` service.
  * @param {DeconzAccessory.Gateway} gateway - The gateway.
    */
  patchLight (gateway) {
    switch (this.manufacturer) {
      case 'Busch-Jaeger':
        // See: https://www.busch-jaeger.de/en/products/product-solutions/dimmer/busch-radio-controlled-dimmer-zigbee-light-link/
        if (
          this.model === 'RM01' && // 6715 U-500 with 6736-84.
          this.capabilities.bri && this.body.type === 'On/Off light' // Issue #241
        ) {
          gateway.debug(
            '%s: ignoring state.bri for %s', this.rpath, this.body.type
          )
          this.capabilities.bri = false
        }
        break
      case 'dresden elektronik':
        // See: https://www.dresden-elektronik.de/funktechnik/solutions/wireless-light-control/wireless-ballasts/?L=1
        this.capabilities.computesXy = true
        break
      case 'FeiBit':
        if (this.model === 'FNB56-SKT1EHG1.2') { // issue #361
          this.body.type = 'On/Off plug-in unit'
        }
        break
      case 'GLEDOPTO':
        // See: https://www.led-trading.de/zigbee-kompatibel-controller-led-lichtsteuerung
        this.capabilities.gamut = {
          r: [0.7006, 0.2993],
          g: [0.1387, 0.8148],
          b: [0.1510, 0.0227]
        }
        if (this.model === 'GLEDOPTO') { // Issue #244
          if (
            this.subtype === '0a' &&
            this.body.type === 'Dimmable light' &&
            this.firmware === '1.0.2'
          ) {
            this.model = 'RGBW'
          } else if (
            this.subtype === '0b' &&
            this.body.type === 'Color temperature light' &&
            this.firmware === '1.3.002'
          ) {
            this.model = 'WW/CW'
          } else if (
            this.subtype === '0b' &&
            this.body.type === 'Extended color light' &&
            this.firmware === '1.0.2'
          ) {
            this.model = 'RGB+CCT'
            const device = gateway.resourceById[this.id]
            if (device != null && device.resourceBySubtype.length > 1) {
              this.model = 'RGBW'
              this.capabilities.ct = false
            }
          } else {
            return
          }
          gateway.debug('%s: set model to %j', this.rpath, this.model)
        }
        break
      case 'IKEA of Sweden':
        // See: http://www.ikea.com/us/en/catalog/categories/departments/lighting/smart_lighting/
        this.capabilities.gamut = defaultGamut // Issue #956
        this.capabilities.noTransition = true
        if (this.model === 'TRADFRI bulb E27 CWS 806lm') {
          this.capabilities.computesXy = true
          this.capabilities.gamut = {
            r: [0.68, 0.31],
            g: [0.11, 0.82],
            b: [0.13, 0.04]
          }
        }
        break
      case 'innr':
        // See: https://shop.innrlighting.com/en/shop
        this.capabilities.gamut = { // Issue #152
          r: [0.8817, 0.1033],
          g: [0.2204, 0.7758],
          b: [0.0551, 0.1940]
        }
        if (this.model === 'SP 120') { // smart plug
          this.capabilities.bri = false
        }
        break
      case 'LIDL Livarno Lux':
        this.capabilities.ctMax = 454 // 2200 K
        this.capabilities.ctMin = 153 // 6500 K
        if (this.model === 'HG06467') { // Xmas light strip
          this.capabilities.colorLoop = false
          this.capabilities.hs = true
          this.capabilities.effects = [
            'Steady', 'Snow', 'Rainbow', 'Snake',
            'Twinkle', 'Fireworks', 'Flag', 'Waves',
            'Updown', 'Vintage', 'Fading', 'Collide',
            'Strobe', 'Sparkles', 'Carnival', 'Glow'
          ]
        }
        break
      case 'MLI': // Issue #439
        this.capabilities.gamut = {
          r: [0.68, 0.31],
          g: [0.11, 0.82],
          b: [0.13, 0.04]
        }
        if (this.capabilities.colorloop) {
          this.capabilities.effects = [
            'Sunset', 'Party', 'Worklight', 'Campfire', 'Romance', 'Nightlight'
          ]
        }
        break
      case 'OSRAM':
        this.capabilities.gamut = {
          r: [0.6877, 0.3161],
          g: [0.1807, 0.7282],
          b: [0.1246, 0.0580]
        }
        break
      case 'Philips':
      case 'Signify Netherlands B.V.': {
        // See: http://www.developers.meethue.com/documentation/supported-lights
        this.manufacturer = 'Signify Netherlands B.V.'
        this.capabilities.breathe = true
        this.capabilities.computesXy = true
        const gamut = hueGamutTypeByModel[this.model] || 'C'
        this.capabilities.gamut = hueGamutType[gamut]
      }
        break
      default:
        break
    }
  }
}

module.exports = Resource
