// homebridge-deconz/lib/Deconz/Resource.js
// Copyright © 2022-2024 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

import { OptionParser } from 'homebridge-lib/OptionParser'

import { ApiClient } from 'hb-deconz-tools/ApiClient'

import { Deconz } from './index.js'
import { DeconzAccessory } from '../DeconzAccessory/index.js'
import '../DeconzAccessory/Gateway.js'
import { DeconzService } from '../DeconzService/index.js'
import '../DeconzService/Button.js'

const { toInstance, toInt, toObject, toString } = OptionParser
const { buttonEvent } = ApiClient
const { SINGLE, DOUBLE, LONG } = DeconzService.Button
const rtypes = ['lights', 'sensors', 'groups']

const patterns = {
  clipId: /^(S[0-9]{1,3})-([0-9a-z]{2})-([0-9a-z]{4})$/i,
  swversion: /^([0-9]+)(?:\.([0-9]+)(?:\.([0-9]+)(?:_([0-9]{4}))?)?)?$/
}

// From low to high.
const sensorsPrios = [
  'Power',
  'Consumption',
  'Temperature',
  'LightLevel',
  'Motion',
  'Contact',
  'AirPurifier',
  'Thermostat',
  'Flag'
]

// =============================================================================

const hueTapMap = {
  34: 1002, // press 1
  16: 2002, // press 2
  17: 3002, // press 3
  18: 4002, // press 4
  100: 5002, // press 1 and 2
  101: 0, // release 1 and 2
  98: 6002, // press 3 and 4
  99: 0 // release 3 and 4
}

/** Delegate class for a resource on a deCONZ gateway.
  *
  * @memberof Deconz
  */
class Resource {
  /** Parse the `uniqueid` in the resource body of a resource for a CLIP sensor.
    * @param {string} uniqueid - The `uniqueid`.
    * @return {object} The MultiCLIP `id`, `endpoint`, and `cluster`.
    */
  static parseClipId (uniqueid) {
    toString('uniqueid', uniqueid, true)
    const a = patterns.clipId.exec(uniqueid.replace(/:/g, '').toUpperCase())
    return {
      id: a?.[1],
      endpoint: a?.[2],
      cluster: a?.[3]
    }
  }

  /** Parse the `swversion` in the resource body of a resource for a Zigbee device.
    * @param {string} swversion - The `swversion`.
    * @return {string} The normalised version in semver format.
    */
  static parseSwversion (swversion) {
    if (swversion == null) {
      return '0.0.0'
    }
    const a = patterns.swversion.exec(swversion)
    if (a?.[1] === '0' && a?.[2] === '0' && a?.[3] === '0' && a?.[4] != null) {
      return '0.0.' + Number(a[4]).toString()
    }
    return swversion
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
    body.name = body.name.replace(/[^\p{L}\p{N} ']/ug, ' ')
      .replace(/^[ ']*/, '')
      .replace(/[ ']*$/, '')
    toString('body.type', body.type, true)

    let realDevice = false

    if (
      this.rtype === 'lights' ||
      (this.rtype === 'sensors' && this.body.type.startsWith('Z'))
    ) {
      const { mac, endpoint, cluster } = ApiClient.parseUniqueid(body.uniqueid)

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
      if (gateway.splitlight[this.rtype]?.[this.rid]) {
        this.id += '-' + endpoint
      }

      /** The subtype of the corresponding HomeKit service.
        *
        * For Zigbee devices, the subtype is based on the Zigbee endpoint and
        * cluster, from the `uniqueid` in the body of the resource.
        * For virtual devices, the subtype is based on the resource type and
        * resource ID.
        * @type {string}
        */
      this.subtype = endpoint + (cluster == null ? '' : '-' + cluster)

      /** Zigbee endpoint.
        * @type {string}
        */
      this.endpoint = endpoint

      /** Zigbee cluster
        * @type {string}
        */
      this.cluster = cluster

      /** Zigbee device vs virtual device.
        *
        * Derived from the resource type and, for `sensors`, on the `type` in the
        * resource body.
        * @type {boolean}
        */
      this.zigbee = true

      realDevice = true
    } else if (this.rtype === 'sensors') {
      const { mac, endpoint, cluster } = ApiClient.parseUniqueid(body.uniqueid)
      if (mac != null && endpoint != null && cluster != null) {
        // uniqueid for proxy device has proper mac, endpoint, cluster
        this.id = mac
        this.subtype = endpoint + '-' + cluster
        this.endpoint = endpoint
        this.cluster = cluster
        realDevice = true
      } else {
        const { id, endpoint, cluster } = Resource.parseClipId(body.uniqueid)
        if (id != null && endpoint != null && cluster != null) {
          // uniqueid for MultiCLIP has proper id, endpoint, cluster
          this.id = gateway.id + '-' + id
          this.subtype = endpoint + '-' + cluster
          this.endpoint = endpoint
          this.cluster = cluster
        } else {
          // ignore uniqueid for regular CLIP
          this.subtype = rtype[0].toUpperCase() + rid
          this.id = gateway.id + '-' + this.subtype
        }
      }
      this.zigbee = false
    } else {
      this.subtype = rtype[0].toUpperCase() + rid
      this.id = gateway.id + '-' + this.subtype
      this.zigbee = false
    }

    /** The associated Homekit _Manufacturer_.
      *
      * For Zigbee devices, this is the sanitised `manufacturername` in the
      * resource body.
      * For virtual devices, this is the _Manufacturer_ for the gateway.
      * @type {string}
      */
    this.manufacturer = realDevice
      ? body.manufacturername.replace(/\//g, '')
      : gateway.values.manufacturer

    /** The associated HomeKit _Model_.
      *
      * For Zigbee devices, this is the sanitised `modelid` in the
      * resource body.
      * For virtual devices, this is the `type` in the resource body.
      * @type {string}
      */
    this.model = realDevice ? body.modelid : body.type

    /** The associated HomeKit _Firmware Version_.
      *
      * For Zigbee devices, this is the sanitised `swversion` in the
      * resource body.
      * For virtual devices, this is the _Firmware Version_ for the gateway.
      */
    this.firmware = realDevice
      ? Resource.parseSwversion(body.swversion)
      : gateway.values.software

    /** The name of the {@link DeconzService} subclass of the delegate of the
      * corresponding HomeKit service, or `null` for unsupported and unknown
      * resources.
      *
      * This is derived from the resource type and `type` in the resource body.
      * @type {string}
      */
    this.serviceName = this._serviceName

    this.capabilities = {}

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
    if (this.rtype === 'groups') {
      return -1
    }
    if (this.rtype === 'lights') {
      return 0xFF - this.endpoint
    }
    return sensorsPrios.indexOf(this.serviceName)
  }

  /** The resource path of the resource, e.g. `/lights/1`.
    *
    * This is derived from the resource type and resource ID.
    * @type {string}
    */
  get rpath () { return '/' + this.rtype + '/' + this.rid }

  get _serviceName () {
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
        case 'On/Off light switch': return 'Switch'
        case 'On/Off light': return 'Light'
        case 'On/Off output': return 'Outlet'
        case 'On/Off plug-in unit': return 'Outlet'
        case 'On/Off switch': return 'Switch'
        case 'Smart plug': return 'Outlet'
        case 'Configuration tool': return ''
        case 'Range extender': return ''
        case 'Warning device': return 'WarningDevice'
        case 'Window covering controller': return 'WindowCovering'
        case 'Window covering device': return 'WindowCovering'
        default: return null
      }
    } else { // (this.rtype === 'sensors')
      const type = /^(CLIP|ZHA|ZGP)?([A-Za-z]*)$/.exec(this.body.type)?.[2]
      switch (type) {
        case 'AirPurifier': return 'AirPurifier'
        case 'AirQuality': return 'AirQuality'
        case 'Alarm': return 'Alarm'
        case 'Battery': return 'Battery'
        case 'CarbonMonoxide': return 'CarbonMonoxide'
        case 'Consumption': return 'Consumption'
        // case 'DoorLock': return null
        case 'Daylight': return 'Daylight'
        case 'DaylightOffset': return ''
        case 'Fire': return 'Smoke'
        case 'GenericFlag': return 'Flag'
        case 'GenericStatus': return 'Status'
        case 'Humidity': return 'Humidity'
        case 'LightLevel': return 'LightLevel'
        case 'Moisture': return 'Humidity'
        case 'OpenClose': return 'Contact'
        case 'ParticulateMatter': return 'AirQuality'
        case 'Power': return 'Power'
        case 'Presence': return 'Motion'
        case 'Pressure': return 'AirPressure'
        case 'RelativeRotary': return 'Label'
        case 'Spectral': return ''
        case 'Switch': return 'Label'
        case 'Temperature': return 'Temperature'
        case 'Thermostat': return 'Thermostat'
        case 'Time': return ''
        case 'Vibration': return 'Motion'
        case 'Water': return 'Leak'
        default: return null
      }
    }
  }

  /** Patch a resource corresponding to a `Light` service.
  * @param {DeconzAccessory.Gateway} gateway - The gateway.
    */
  patchLight (gateway) {
    switch (this.manufacturer) {
      case 'GLEDOPTO':
        if (this.model === 'GLEDOPTO') { // Issue #244
          if (
            this.endpoint === '0A' &&
            this.body.type === 'Dimmable light' &&
            this.firmware === '1.0.2'
          ) {
            this.model = 'RGBW'
          } else if (
            this.endpoint === '0B' &&
            this.body.type === 'Color temperature light' &&
            this.firmware === '1.3.002'
          ) {
            this.model = 'WW/CW'
          } else if (
            this.endpoint === '0B' &&
            this.body.type === 'Extended color light' &&
            this.firmware === '1.0.2'
          ) {
            this.model = 'RGB+CCT'
            const device = gateway.deviceById[this.id]
            if (device != null) {
              this.model = 'RGBW'
              this.capabilities.ct = false
            }
          } else {
            return
          }
          gateway.vdebug('%s: set model to %j', this.rpath, this.model)
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
      default:
        break
    }
  }

  /** Patch a resource corresponding to a `Flag` service.
    */
  patchFlag () {
    if (this.endpoint != null && this.cluster === '0006') {
      if (this.body.swversion === '0') {
        this.capabilities.readonly = true
      }
    }
  }

  /** Patch a resource corresponding to a `Status` service.
    */
  patchStatus () {
    if (this.endpoint != null && this.cluster === '0012') {
      const a = this.body.swversion.split(',')
      const min = parseInt(a[0])
      const max = parseInt(a[1])
      if (min === 0 && max === 0) {
        this.capabilities.readonly = true
      } else if (min >= -127 && max <= 127 && min < max) {
        this.capabilities.min = min
        this.capabilities.max = max
      }
    }
  }

  /** Patch a resource corresponding to a `Label` service.
  * @param {DeconzAccessory.Gateway} gateway - The gateway.
    */
  patchLabel (gateway) {
    const buttons = []
    let dots = false
    switch (this.manufacturer) {
      case 'Bitron Home':
        switch (this.model) {
          case '902010/23': // Bitron remote, see #639.
            dots = true
            buttons.push([1, 'Dim Up', SINGLE])
            buttons.push([2, 'On', SINGLE])
            buttons.push([3, 'Off', SINGLE])
            buttons.push([4, 'Dim Down', SINGLE])
            break
          default:
            break
        }
        break
      case 'Busch-Jaeger':
        switch (this.model) {
          case 'RM01': // Busch-Jaeger Light Link control element (mains-powered)
          case 'RB01': // Busch-Jaeger Light Link wall-mounted transmitter
            if (this.endpoint === '0A') {
              buttons.push([1, 'Button 1', SINGLE | LONG])
              buttons.push([2, 'Button 2', SINGLE | LONG])
            } else if (this.endpoint === '0B') {
              buttons.push([3, 'Button 3', SINGLE | LONG])
              buttons.push([4, 'Button 4', SINGLE | LONG])
            } else if (this.endpoint === '0C') {
              buttons.push([5, 'Button 5', SINGLE | LONG])
              buttons.push([6, 'Button 6', SINGLE | LONG])
            } else if (this.endpoint === '0D') {
              buttons.push([7, 'Button 7', SINGLE | LONG])
              buttons.push([8, 'Button 8', SINGLE | LONG])
            }
            break
          default:
            break
        }
        break
      case 'Echostar':
        switch (this.model) {
          case 'Bell':
            buttons.push([1, 'Front Doorbell', SINGLE])
            buttons.push([2, 'Rear Doorbell', SINGLE])
            break
          default:
            break
        }
        break
      case 'ELKO':
        switch (this.model) {
          case 'ElkoDimmerRemoteZHA': // ELKO ESH 316 Endevender RF, see #922.
            buttons.push([1, 'Press', SINGLE])
            buttons.push([2, 'Dim Up', SINGLE])
            buttons.push([3, 'Dim Down', SINGLE])
            break
          default:
            break
        }
        break
      case 'Heiman':
        switch (this.model) {
          case 'RC-EF-3.0':
            dots = true
            buttons.push([1, 'HomeMode', SINGLE])
            buttons.push([2, 'Disarm', SINGLE])
            buttons.push([3, 'SOS', SINGLE])
            buttons.push([4, 'Arm', SINGLE])
            break
          default:
            break
        }
        break
      case 'IKEA of Sweden':
        switch (this.model) {
          case 'Remote Control N2':
            buttons.push([1, 'Dim Up', SINGLE | LONG])
            buttons.push([2, 'Dim Down', SINGLE | LONG])
            buttons.push([3, 'Previous', SINGLE | LONG])
            buttons.push([4, 'Next', SINGLE | LONG])
            break
          case 'RODRET Dimmer':
            buttons.push([1, 'Dim Up', SINGLE | LONG])
            buttons.push([2, 'Dim Down', SINGLE | LONG])
            break
          case 'SOMRIG shortcut button':
            dots = true
            buttons.push([1, '1', SINGLE | DOUBLE | LONG])
            buttons.push([2, '2', SINGLE | DOUBLE | LONG])
            break
          case 'SYMFONISK Sound Controller':
            if (this.cluster === '1000') {
              buttons.push([1, 'Button', SINGLE | DOUBLE | LONG])
              if (this.body.mode === 1) {
                buttons.push([2, 'Turn Right', LONG])
                buttons.push([3, 'Turn Left', LONG])
              } else {
                buttons.push([2, 'Turn Right', SINGLE])
                buttons.push([3, 'Turn Left', SINGLE])
              }
            } else if (this.cluster === '0008') { // ZHARelativeRotary
              // buttons.push([4, 'Turn Right', SINGLE])
              // buttons.push([5, 'Turn Left', SINGLE])
            }
            break
          case 'SYMFONISK sound remote gen2':
            buttons.push([1, 'Play', SINGLE])
            buttons.push([2, 'Plus', SINGLE | LONG, true])
            buttons.push([3, 'Minus', SINGLE | LONG, true])
            buttons.push([4, 'Previous', SINGLE])
            buttons.push([5, 'Next', SINGLE])
            buttons.push([6, 'One Dot', SINGLE | DOUBLE | LONG])
            buttons.push([7, 'Two Dots', SINGLE | DOUBLE | LONG])
            break
          case 'TRADFRI SHORTCUT Button':
            buttons.push([1, 'Button', SINGLE | DOUBLE | LONG])
            break
          case 'TRADFRI on/off switch':
            buttons.push([1, 'On', SINGLE | LONG])
            buttons.push([2, 'Off', SINGLE | LONG])
            break
          case 'TRADFRI open/close remote':
            buttons.push([1, 'Open', SINGLE | LONG])
            buttons.push([2, 'Close', SINGLE | LONG])
            break
          case 'TRADFRI remote control':
            buttons.push([1, 'Power', SINGLE])
            buttons.push([2, 'Dim Up', SINGLE | LONG])
            buttons.push([3, 'Dim Down', SINGLE | LONG])
            buttons.push([4, 'Previous', SINGLE | LONG])
            buttons.push([5, 'Next', SINGLE | LONG])
            break
          case 'TRADFRI wireless dimmer':
            if (this.body.mode === 1) {
              buttons.push([1, 'Turn Right', SINGLE | LONG])
              buttons.push([2, 'Turn Left', SINGLE | LONG])
            } else {
              buttons.push([1, 'On', SINGLE])
              buttons.push([2, 'Dim Up', SINGLE])
              buttons.push([3, 'Dim Down', SINGLE])
              buttons.push([4, 'Off', SINGLE])
            }
            break
          default:
            break
        }
        break
      case 'Insta':
        switch (this.model) {
          case 'HS_4f_GJ_1': // Gira/Jung Light Link hand transmitter
          case 'WS_3f_G_1': // Gira Light Link wall transmitter
          case 'WS_4f_J_1': // Jung Light Link wall transmitter
            buttons.push([1, 'Off', SINGLE | DOUBLE | LONG])
            buttons.push([2, 'On', SINGLE | DOUBLE | LONG])
            buttons.push([3, 'Scene 1', SINGLE])
            buttons.push([4, 'Scene 2', SINGLE])
            buttons.push([5, 'Scene 3', SINGLE])
            buttons.push([6, 'Scene 4', SINGLE])
            if (this.model !== 'WS_3f_G_1') {
              buttons.push([7, 'Scene 5', SINGLE])
              buttons.push([8, 'Scene 6', SINGLE])
            }
            break
          default:
            break
        }
        break
      case 'LDS':
        switch (this.model) {
          case 'ZBT-DIMController-D0800':
            buttons.push([1, 'Power', SINGLE])
            buttons.push([2, 'Dim Up', SINGLE | LONG])
            buttons.push([3, 'Dim Down', SINGLE | LONG])
            buttons.push([4, 'Scene', SINGLE | LONG])
            break
          default:
            break
        }
        break
      case 'LIDL Livarno Lux':
        switch (this.model) {
          case 'HG06323':
            buttons.push([1, 'On', SINGLE | DOUBLE | LONG])
            buttons.push([2, 'Dim Up', SINGLE | LONG])
            buttons.push([3, 'Dim Down', SINGLE | LONG])
            buttons.push([4, 'Off', SINGLE])
            break
          default:
            break
        }
        break
      case 'LUMI':
        switch (this.model) {
          case 'lumi.ctrl_neutral1':
            buttons.push([1, 'Button', SINGLE])
            break
          case 'lumi.ctrl_neutral2':
            buttons.push([1, 'Left', SINGLE])
            buttons.push([2, 'Right', SINGLE])
            buttons.push([3, 'Both', SINGLE])
            break
          case 'lumi.remote.b1acn01':
          case 'lumi.remote.b186acn01':
          case 'lumi.remote.b186acn02':
            buttons.push([1, 'Button', SINGLE | DOUBLE | LONG])
            break
          case 'lumi.remote.b28ac1':
          case 'lumi.remote.b286acn01':
          case 'lumi.remote.b286acn02':
            buttons.push([1, 'Left', SINGLE | DOUBLE | LONG])
            buttons.push([2, 'Right', SINGLE | DOUBLE | LONG])
            buttons.push([3, 'Both', SINGLE | DOUBLE | LONG])
            break
          case 'lumi.remote.b286opcn01': // Xiaomi Aqara Opple, see #637.
          case 'lumi.remote.b486opcn01': // Xiaomi Aqara Opple, see #637.
          case 'lumi.remote.b686opcn01': // Xiaomi Aqara Opple, see #637.
            buttons.push([1, '1', SINGLE | DOUBLE | LONG])
            buttons.push([2, '2', SINGLE | DOUBLE | LONG])
            if (this.model !== 'lumi.remote.b286opcn01') {
              buttons.push([3, '3', SINGLE | DOUBLE | LONG])
              buttons.push([4, '4', SINGLE | DOUBLE | LONG])
              if (this.model === 'lumi.remote.b686opcn01') {
                buttons.push([5, '5', SINGLE | DOUBLE | LONG])
                buttons.push([6, '6', SINGLE | DOUBLE | LONG])
              }
            }
            break
          case 'lumi.ctrl_ln1.aq1':
          case 'lumi.sensor_86sw1': // Xiaomi wall switch (single button).
          case 'lumi.switch.l1aeu1': // Xiaomi Aqara H1, see #1149.
          case 'lumi.switch.n1aeu1': // Xiaomi Aqara H1, see #1149.
            buttons.push([1, 'Button', SINGLE | DOUBLE])
            break
          case 'lumi.ctrl_ln2.aq1':
          case 'lumi.sensor_86sw2': // Xiaomi wall switch (two buttons).
          case 'lumi.switch.l2aeu1': // Xiaomi Aqara H2, see #1149.
          case 'lumi.switch.n2aeu1': // Xiaomi Aqara H2, see #1149.
            buttons.push([1, 'Left', SINGLE | DOUBLE])
            buttons.push([2, 'Right', SINGLE | DOUBLE])
            buttons.push([3, 'Both', SINGLE | DOUBLE])
            break
          case 'lumi.sensor_cube':
          case 'lumi.sensor_cube.aqgl01':
            if (this.endpoint === '02') {
              buttons.push([1, 'Side 1', SINGLE | DOUBLE | LONG])
              buttons.push([2, 'Side 2', SINGLE | DOUBLE | LONG])
              buttons.push([3, 'Side 3', SINGLE | DOUBLE | LONG])
              buttons.push([4, 'Side 4', SINGLE | DOUBLE | LONG])
              buttons.push([5, 'Side 5', SINGLE | DOUBLE | LONG])
              buttons.push([6, 'Side 6', SINGLE | DOUBLE | LONG])
              buttons.push([7, 'Cube', SINGLE | DOUBLE | LONG])
              this.capabilities.toButtonEvent = (v) => {
                const button = Math.floor(v / 1000)
                let event = v % 1000
                if (v === 7000) { // Wakeup
                  event = buttonEvent.SHORT_RELEASE
                } else if (v === 7007 || v === 7008) { // Shake, Drop
                } else if (event === 0) { // Push
                  event = buttonEvent.LONG_RELEASE
                } else if (event === button) { // Double tap
                  event = buttonEvent.DOUBLE_PRESS
                } else { // Flip
                  event = buttonEvent.SHORT_RELEASE
                }
                return button * 1000 + event
              }
            } else if (this.endpoint === '03') {
              buttons.push([8, 'Turn Right', SINGLE | DOUBLE | LONG])
              buttons.push([9, 'Turn Left', SINGLE | DOUBLE | LONG])
              this.capabilities.toButtonEvent = (v) => {
                const button = v > 0 ? 8 : 9
                const event = Math.abs(v) < 4500
                  ? buttonEvent.SHORT_RELEASE
                  : Math.abs(v) < 9000
                    ? buttonEvent.DOUBLE_PRESS
                    : buttonEvent.LONG_RELEASE
                return button * 1000 + event
              }
            }
            break
          case 'lumi.sensor_switch': // Xiaomi Mi wireless switch
          case 'lumi.sensor_switch.aq2': // Xiaomi Aqara smart wireless switch
          case 'lumi.sensor_switch.aq3': // Xiaomi Aqara smart wireless switch with gyro
            buttons.push([1, 'Button', SINGLE | DOUBLE | LONG])
            break
          default:
            break
        }
        break
      case 'Lutron':
        switch (this.model) {
          case 'LZL4BWHL01 Remote': // Lutron Pico, see 102.
            buttons.push([1, 'On', SINGLE])
            buttons.push([2, 'Dim Up', LONG])
            buttons.push([3, 'Dim Down', LONG])
            buttons.push([4, 'Off', SINGLE])
            break
          case 'Z3-1BRL': // Lutron Aurora, see #522.
            buttons.push([1, 'Button', SINGLE])
            buttons.push([2, 'Turn Right', SINGLE])
            buttons.push([3, 'Turn Left', SINGLE])
            break
          default:
            break
        }
        break
      case 'MLI':
        switch (this.model) {
          case 'ZBT-Remote-ALL-RGBW': // Tint remote control by Müller-Licht see deconz-rest-plugin#1209
            buttons.push([1, 'Power', SINGLE])
            buttons.push([2, 'Dim Up', SINGLE | LONG])
            buttons.push([3, 'Dim Down', SINGLE | LONG])
            buttons.push([4, 'Warm', SINGLE])
            buttons.push([5, 'Cool', SINGLE])
            buttons.push([6, 'Colour Wheel', SINGLE])
            buttons.push([7, 'Work Light', SINGLE])
            buttons.push([8, 'Sunset', SINGLE])
            buttons.push([9, 'Party', SINGLE])
            buttons.push([10, 'Night Light', SINGLE])
            buttons.push([11, 'Campfire', SINGLE])
            buttons.push([12, 'Romance', SINGLE])
            break
          default:
            break
        }
        break
      case 'OSRAM':
        switch (this.model) {
          case 'Lightify Switch Mini':
            buttons.push([1, 'Up', SINGLE | LONG])
            buttons.push([2, 'Down', SINGLE | LONG])
            buttons.push([3, 'Middle', SINGLE | LONG])
            break
          case 'Switch 4x EU-LIGHTIFY':
          case 'Switch 4x-LIGHTIFY':
            buttons.push([1, 'Top Left', SINGLE | LONG])
            buttons.push([2, 'Top Right', SINGLE | LONG])
            buttons.push([3, 'Bottom Left', SINGLE | LONG])
            buttons.push([4, 'Bottom Right', SINGLE | LONG])
            break
          default:
            break
        }
        break
      case 'Philips':
      case 'Signify Netherlands B.V.':
        switch (this.model) {
          case 'RDM001': // Hue wall switch module
          case 'RDM004': // Hue wall switch module
            switch (this.body.config.devicemode) {
              case 'singlerocker':
                buttons.push([1, 'Rocker 1', SINGLE])
                break
              case 'singlepushbutton':
                buttons.push([1, 'Push Button 1', SINGLE | LONG, true])
                break
              case 'dualrocker':
                buttons.push([1, 'Rocker 1', SINGLE])
                buttons.push([2, 'Rocker 2', SINGLE])
                break
              case 'dualpushbutton':
                buttons.push([1, 'Push Button 1', SINGLE | LONG, true])
                buttons.push([2, 'Push Button 2', SINGLE | LONG, true])
                break
              default:
                break
            }
            break
          case 'RDM002': // Hue tap dial switch
            dots = true
            if (this.endpoint === '01') {
              buttons.push([1, '1', SINGLE | LONG, true])
              buttons.push([2, '2', SINGLE | LONG, true])
              buttons.push([3, '3', SINGLE | LONG, true])
              buttons.push([4, '4', SINGLE | LONG, true])
            } else if (this.endpoint === '14') { // ZHARelativeRotary
              buttons.push([5, 'Right Turn', SINGLE])
              buttons.push([6, 'Left Turn', SINGLE])
            }
            break
          case 'ROM001': // Hue smart button
          case 'RDM003': // Hue smart button
            buttons.push([1, 'Button', SINGLE | LONG, true])
            break
          case 'RWL020':
          case 'RWL021': // Hue dimmer switch
            buttons.push([1, 'On', SINGLE | LONG])
            buttons.push([2, 'Dim Up', SINGLE | LONG, true])
            buttons.push([3, 'Dim Down', SINGLE | LONG, true])
            buttons.push([4, 'Off', SINGLE | LONG])
            break
          case 'RWL022': // Hue dimmer switch (2021)
            buttons.push([1, 'Power', SINGLE | LONG])
            buttons.push([2, 'Dim Up', SINGLE | LONG, true])
            buttons.push([3, 'Dim Down', SINGLE | LONG, true])
            buttons.push([4, 'Hue', SINGLE | LONG])
            break
          case 'ZGPSWITCH': // Hue tap
            dots = true
            buttons.push([1, '1', SINGLE])
            buttons.push([2, '2', SINGLE])
            buttons.push([3, '3', SINGLE])
            buttons.push([4, '4', SINGLE])
            buttons.push([5, '1 and 2', SINGLE])
            buttons.push([6, '3 and 4', SINGLE])
            this.capabilities.toButtonEvent = (v) => {
              return hueTapMap[v]
            }
            break
          default:
            break
        }
        break
      case 'PhilipsFoH':
        if (this.model === 'FOHSWITCH') { // Friends-of-Hue switch
          buttons.push([1, 'Top Left', SINGLE | LONG])
          buttons.push([2, 'Bottom Left', SINGLE | LONG])
          buttons.push([3, 'Top Right', SINGLE | LONG])
          buttons.push([4, 'Bottom Right', SINGLE | LONG])
          buttons.push([5, 'Top Both', SINGLE | LONG])
          buttons.push([6, 'Bottom Both', SINGLE | LONG])
        }
        break
      case 'Schneider Electric':
        if (this.model === 'FLS/AIRLINK/4' || this.model === 'FLS/SYSTEM-M/4') {
          buttons.push([1, 'Top Right', SINGLE | LONG])
          buttons.push([2, 'Bottom Right', SINGLE | LONG])
          buttons.push([3, 'Top Left', SINGLE | LONG])
          buttons.push([4, 'Bottom Left', SINGLE | LONG])
        }
        break
      case 'Samjin':
        switch (this.model) {
          case 'button':
            buttons.push([1, 'Button', SINGLE | DOUBLE | LONG])
            break
          default:
            break
        }
        break
      case 'Sunricher':
        switch (this.model) {
          case 'ZG2833K4_EU06': // Sunricher 4-button remote
          case 'ZG2833K8_EU05': // Sunricher 8-button remote, see #529.
            if (this.endpoint === '01') {
              buttons.push([1, 'On 1', SINGLE | LONG])
              buttons.push([2, 'Off 1', SINGLE | LONG])
            } else if (this.endpoint === '02') {
              buttons.push([3, 'On 2', SINGLE | LONG])
              buttons.push([4, 'Off 2', SINGLE | LONG])
            } else if (this.endpoint === '03') {
              buttons.push([5, 'On 3', SINGLE | LONG])
              buttons.push([6, 'Off 3', SINGLE | LONG])
            } else if (this.endpoint === '04') {
              buttons.push([7, 'On 4', SINGLE | LONG])
              buttons.push([8, 'Off 4', SINGLE | LONG])
            }
            break
          case 'ZG2833PAC': // Sunricher C4
            buttons.push([1, 'Rocker 1', SINGLE])
            buttons.push([2, 'Rocker 2', SINGLE])
            buttons.push([3, 'Rocker 3', SINGLE])
            buttons.push([4, 'Rocker 4', SINGLE])
            break
          case 'ZGRC-KEY-002': // Sunricher CCT remote, see #529.
            buttons.push([1, 'On', SINGLE])
            buttons.push([2, 'Off', SINGLE])
            buttons.push([3, 'Dim', LONG])
            buttons.push([4, 'C/W', SINGLE | LONG])
            break
          default:
            break
        }
        break
      case '_TZ3000_arfwfgoa':
        switch (this.model) {
          case 'TS0042': // Tuys 2-button switch, single endpoint
            buttons.push([1, 'Left', SINGLE | DOUBLE | LONG])
            buttons.push([2, 'Right', SINGLE | DOUBLE | LONG])
            break
          default:
            break
        }
        break
      case '_TZ3000_dfgbtub0':
      case '_TZ3000_i3rjdrwu':
        switch (this.model) {
          case 'TS0042': // Tuya 2-button switch, see #1060.
            if (this.endpoint === '01') {
              buttons.push([1, 'Button 1', SINGLE | DOUBLE | LONG])
            } else if (this.endpoint === '02') {
              buttons.push([2, 'Button 2', SINGLE | DOUBLE | LONG])
            }
            break
          default:
            break
        }
        break
      case '_TZ3000_mh9px7cq':
        switch (this.model) {
          case 'TS0044':
            buttons.push([1, 'Button 1', SINGLE | DOUBLE | LONG])
            buttons.push([2, 'Button 2', SINGLE | DOUBLE | LONG])
            buttons.push([3, 'Button 3', SINGLE | DOUBLE | LONG])
            buttons.push([4, 'Button 4', SINGLE | DOUBLE | LONG])
            break
          default:
            break
        }
        break
      case '_TZ3000_pzui3skt':
        switch (this.model) {
          case 'TS0041': // Tuya 1-button switch
            buttons.push([1, 'Button', SINGLE | DOUBLE | LONG])
            break
          default:
            break
        }
        break
      case '_TZ3000_rrjr1q0u':
        switch (this.model) {
          case 'TS0043': // Tuya 3-button switch
            buttons.push([1, 'Left', SINGLE | DOUBLE | LONG])
            buttons.push([2, 'Middle', SINGLE | DOUBLE | LONG])
            buttons.push([3, 'Right', SINGLE | DOUBLE | LONG])
            break
          default:
            break
        }
        break
      case '_TZ3000_vp6clf9d':
        switch (this.model) {
          case 'TS0044':
            buttons.push([1, 'Bottom Left', SINGLE | DOUBLE | LONG])
            buttons.push([2, 'Bottom Right', SINGLE | DOUBLE | LONG])
            buttons.push([3, 'Top Right', SINGLE | DOUBLE | LONG])
            buttons.push([4, 'Top Left', SINGLE | DOUBLE | LONG])
            break
          default:
            break
        }
        break
      case '_TZ3000_wkai4ga5':
        switch (this.model) {
          case 'TS0044':
            dots = true
            buttons.push([1, 'Top Left', SINGLE | DOUBLE | LONG])
            buttons.push([2, 'Top Right', SINGLE | DOUBLE | LONG])
            buttons.push([3, 'Bottom Left', SINGLE | DOUBLE | LONG])
            buttons.push([4, 'Bottom Right', SINGLE | DOUBLE | LONG])
            break
          default:
            break
        }
        break
      case '_TZ3000_xabckq1v':
        switch (this.model) {
          case 'TS004F': // Tuya 4-button switch, single press only
            buttons.push([1, 'Top Left', SINGLE])
            buttons.push([2, 'Bottom Left', SINGLE])
            buttons.push([3, 'Top Right', SINGLE])
            buttons.push([4, 'Bottom Right', SINGLE])
            break
          default:
            break
        }
        break
      case 'dresden elektronik':
        switch (this.model) {
          case 'Kobold':
            buttons.push([1, 'Button', SINGLE | LONG])
            break
          case 'Lighting Switch':
            if (this.endpoint === '01') {
              if (this.body.mode !== 2) {
                gateway.vdebug(
                  '%s: Lighting Switch mode %d instead of 2',
                  this.rpath, this.body.mode
                )
              }
              buttons.push([1, 'Top Left', SINGLE | LONG])
              buttons.push([2, 'Bottom Left', SINGLE | LONG])
              buttons.push([3, 'Top Right', SINGLE | LONG])
              buttons.push([4, 'Bottom Right', SINGLE | LONG])
            }
            break
          case 'Scene Switch':
            buttons.push([1, 'On', SINGLE | LONG])
            buttons.push([2, 'Off', SINGLE | LONG])
            buttons.push([3, 'Scene 1', SINGLE])
            buttons.push([4, 'Scene 2', SINGLE])
            buttons.push([5, 'Scene 3', SINGLE])
            buttons.push([6, 'Scene 4', SINGLE])
            break
          default:
            break
        }
        break
      case 'eWeLink':
        switch (this.model) {
          case 'WB01':
            buttons.push([1, 'Press', SINGLE | DOUBLE | LONG])
            break
          default:
            break
        }
        break
      case 'icasa':
        switch (this.model) {
          case 'ICZB-KPD12':
          case 'ICZB-KPD14S':
          case 'ICZB-KPD18S':
            buttons.push([1, 'Off', SINGLE | LONG])
            buttons.push([2, 'On', SINGLE | LONG])
            if (this.model !== 'ICZB-KPD12') {
              buttons.push([3, 'S1', SINGLE])
              buttons.push([4, 'S2', SINGLE])
              if (this.model === 'ICZB-KPD18S') {
                buttons.push([5, 'S3', SINGLE])
                buttons.push([6, 'S4', SINGLE])
                buttons.push([7, 'S5', SINGLE])
                buttons.push([8, 'S6', SINGLE])
              }
            }
            break
          case 'ICZB-RM11S':
            buttons.push([1, '1 Off', SINGLE | LONG])
            buttons.push([2, '1 On', SINGLE | LONG])
            buttons.push([3, '2 Off', SINGLE | LONG])
            buttons.push([4, '2 On', SINGLE | LONG])
            buttons.push([5, '3 Off', SINGLE | LONG])
            buttons.push([6, '3 On', SINGLE | LONG])
            buttons.push([7, '4 Off', SINGLE | LONG])
            buttons.push([8, '4 On', SINGLE | LONG])
            buttons.push([9, 'S1', SINGLE])
            buttons.push([10, 'S2', SINGLE])
            break
          default:
            break
        }
        break
      case 'innr':
        switch (this.model) {
          case 'RC 110':
            if (this.endpoint === '01') {
              buttons.push([1, 'Power', SINGLE])
              buttons.push([2, 'Dim Up', SINGLE | LONG])
              buttons.push([3, 'Dim Down', SINGLE | LONG])
              buttons.push([4, '1', SINGLE])
              buttons.push([5, '2', SINGLE])
              buttons.push([6, '3', SINGLE])
              buttons.push([7, '4', SINGLE])
              buttons.push([8, '5', SINGLE])
              buttons.push([9, '6', SINGLE])
              for (let i = 1; i <= 6; i++) {
                const button = 7 + i * 3
                buttons.push([button, `Power ${i}`, SINGLE])
                buttons.push([button + 1, `Dim Up ${i}`, SINGLE | LONG])
                buttons.push([button + 2, `Dim Down ${i}`, SINGLE | LONG])
              }
            }
            break
          default:
            break
        }
        break
      case 'lk':
        switch (this.model) {
          case 'ZBT-DIMSwitch-D0001': // Linkind 1-Key Remote Control, see #949.
            buttons.push([1, 'Button', SINGLE | LONG])
            this.capabilities.homekitValue = (v) => { return 1 }
            break
          default:
            break
        }
        break
      case 'ubisys':
        switch (this.model) {
          case 'C4 (5504)':
          case 'C4-R (5604)':
            buttons.push([1, '1', SINGLE | LONG])
            buttons.push([2, '2', SINGLE | LONG])
            buttons.push([3, '3', SINGLE | LONG])
            buttons.push([4, '4', SINGLE | LONG])
            break
          case 'D1 (5503)':
          case 'D1-R (5603)':
          case 'S1-R (5601)':
          case 'S2 (5502)':
          case 'S2-R (5602)':
            buttons.push([1, '1', SINGLE | LONG])
            buttons.push([2, '2', SINGLE | LONG])
            break
          case 'S1 (5501)':
            buttons.push([1, '1', SINGLE | LONG])
            break
          default:
            break
        }
        break
      default:
        break
    }
    if (buttons.length > 0) {
      this.capabilities.buttons = {}
      for (const button of buttons) {
        this.capabilities.buttons[button[0]] = {
          label: button[1],
          events: button[2],
          hasRepeat: button[3]
        }
      }
      this.capabilities.namespace = dots
        ? gateway.Characteristics.hap.ServiceLabelNamespace.DOTS
        : gateway.Characteristics.hap.ServiceLabelNamespace.ARABIC_NUMERALS
    }
  }

  /** Patch a resource corresponding to a `Motion` service.
    */
  patchMotion () {
    if (this.manufacturer === 'Aqara' && this.model === 'PS-S02D') {
      if (this.endpoint !== '01') {
        this.id += '-' + this.endpoint
      }
    }
  }

  /** Patch a resource corresponding to a `Thermostat` service.
    */
  patchThermostat () {
    if (this.manufacturer === 'ELKO' && this.model === 'Super TR') {
      this.capabilities.heatValue = 'heat'
    } else {
      this.capabilities.heatValue = 'auto'
    }
  }

  /** Patch a resource corresponding to a `WindowCovering` service.
    */
  patchWindowCovering () {
    if (this.manufacturer === 'LUMI' && this.model === 'lumi.curtain.acn002') {
      this.capabilities.maxSpeed = 2
      this.capabilities.positionChange = true
    } else if (this.manufacturer === 'ubisys') {
      this.capabilities.useOpen = true
    }
  }
}

Deconz.Resource = Resource
