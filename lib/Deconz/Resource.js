// homebridge-deconz/lib/Deconz/Resource.js
// Copyright © 2022 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const homebridgeLib = require('homebridge-lib')

const { toInt, toObject, toString } = homebridgeLib.OptionParser

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
    * @param {string} gid - The device ID of the gateway.
    * @param {string} rtype - The resource type of the resource:
    * `groups`, `lights`, or `sensors`.
    * @param {integer} rid - The resource ID of the resource.
    * @param {object} body - The body of the resource.
    */
  constructor (gid, rtype, rid, body) {
    toString('gid', gid, true)

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
      this.id = gid + this.subtype
      this.zigbee = false
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
      return 'Group'
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
}

module.exports = Resource
