// homebridge-deconz/lib/DeconzDevice.js
// Copyright © 2022 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

/** A Zigbee or virtual devices exposed by the gateway.
  */
class DeconzDevice {
  static get Resource () { return Resource }
  static get ResourceAttributes () { return ResourceAttributes }
  static get TypeAttributes () { return TypeAttributes }

  /** Instantiate a Device from a gayeway resource.
    *
    * @param {string} rtype - The type of the resource:
    * `config`, `group`, `light`, or `sensor`.
    * @param {integer} rid - The resource ID of the resource.
    * @param {object} body - The body of the resource.
    * @params {DeconzDevice.ResourceAttributes} attrs - Derived
    * resource attributes.
    */
  constructor (rtype, rid, body, attrs) {
    /** The device ID.
      *
      * For Zigbee devices, the device ID is based on the Zigbee mac address
      * of the device.
      * For virtual devices, the device ID is based on the Zigbee mac address
      * of the gayeway and the resource.
      * The UUID of the associated HomeKit accessory is based on the device ID.
      * @type {string}
      */
    this.id = attrs.id

    /** Zigbee device vs virtual device.
      * @type {boolean}
      */
    this.zigbee = attrs.zigbee

    /** A map of Resource by subtype.
      * @type {Object.<string, DeconzDevice.Resource>}
      */
    this.resourceBySubtype = {}
  }

  /** The primary resource.
    * @type {DeconzDevice.Resource}
    */
  get resource () { return this.resourceBySubtype[this.primary] }

  /** List of resource paths of associated resources in order of priority.
    * @type {string[]}
    */
  get rpaths () {
    return Object.keys(this.resourceBySubtype || {}).map((subtype) => {
      return this.resourceBySubtype[subtype].rpath
    })
  }

  /** Add a Resource from a gayeway resource.
    *
    * @param {string} rtype - The type of the resource:
    * `config`, `group`, `light`, or `sensor`.
    * @param {integer} rid - The resource ID of the resource.
    * @param {object} body - The body of the resource.
    * @params {DeconzDevice.ResourceAttributes} - Derived resource
    * attributes.
    */
  addResource (rtype, rid, body, attrs) {
    const { id, subtype, zigbee } = attrs
    if (this.resourceBySubtype[subtype] != null) {
      const r = this.resourceBySubtype[subtype]
      throw new Error(
        `${attrs.resource}: duplicate uniqueid ${body.uniqueid} in ${r.attrs.resource}`
      )
    }
    if (zigbee !== this.zigbee || (zigbee && id !== this.id)) {
      const r = this.resourceBySubtype[subtype]
      throw new SyntaxError(
        `${attrs.resource}: cannot combine ${r.attrs.resource}`
      )
    }
    this.resourceBySubtype[subtype] = new Resource(rtype, rid, body, attrs)
    if (
      this.primary == null || (
        this.resource.rtype === rtype && this.resource.attrs.prio < attrs.prio
      )
    ) {
      /** The subtype of the primary
        * {@link DeconzDevice.Resource Resource}.
        *
        * @type {string}
        */
      this.primary = subtype
    }
    return this.resourceBySubtype[subtype]
  }
}

/** A resource exposed by the gateway.
  *
  * @memberof DeconzDevice
  */
class Resource {
  /** Instantiate a Resource from a gayeway resource.
    *
    * @param {string} rtype - The type of the resource:
    * `config`, `group`, `light`, or `sensor`.
    * @param {integer} rid - The resource ID of the resource.
    * @param {object} body - The body of the resource.
    * @params {DeconzDevice.ResourceAttributes} attrs - Derived
    * resource attributes.
    */
  constructor (rtype, rid, body, attrs) {
    /** The resource type: `groups`, `lights`, or `sensors`.
      * @type {string}
      */
    this.rtype = rtype

    /** The resource ID.
      * @type {integer}
      */
    this.rid = rid

    /** The resource body.
      * @param {object}
      */
    this.body = body

    this.attrs = attrs
  }

  /** The associated HomeKit Accessory category.
    * `null` for unknown types.
    * @type {?Accessory.Category}
    */
  get category () { return this.attrs.type.category }

  /** The associated device ID.
    *
    * For Zigbee devices, the device ID is based on the Zigbee mac address
    * of the device.
    * For virtual devices, the device ID is based on the Zigbee mac address
    * of the gayeway and the resource.
    * The UUID of the associated HomeKit accessory is based on the device ID.
    * @type {string}
    */
  get id () { return this.attrs.id }

  /** The priority of the resource type when determining the primary service.
    * @type {integer}
    */
  get prio () { return this.attrs.type.prio }

  /** The resource exposed by the gateway, e.g. `/lights/1`
    * @type {string}
    */
  get rpath () { return '/' + this.rtype + '/' + this.rid }

  /** The name of the DeconzService to expose the resouce type.
    * `null` for unsupported types.
    * @type {string}
    */
  get serviceName () { return this.attrs.type.serviceName }

  /** The subtype of the associated HomeKit service.
    *
    * For Zigbee devices, the subtype is based on the Zigbee endpoint and
    * cluster, corresponding to the resouce.
    * For virtual devices, the subtype is based on the resource.
    * @type {string[]}
    */
  get subtype () { return this.attrs.subtype }

  /** Zigbee device vs virtual device.
    * @type {boolean}
    */
  get zigbee () { return this.attrs.zigbee }
}

/** Derived attributes of a resource.
  * @hideconstructor
  * @memberof DeconzDevice
  */
class ResourceAttributes {
  constructor (id, subtype, type, zigbee) {
    /** The associated device ID.
      *
      * For Zigbee devices, the device ID is based on the Zigbee mac address
      * of the device.
      * For virtual devices, the device ID is based on the Zigbee mac address
      * of the gayeway and the resource.
      * The UUID of the associated HomeKit accessory is based on the device ID.
      * @type {string}
      */
    this.id = id

    /** The subtype of the associated HomeKit service.
      *
      * For Zigbee devices, the subtype is based on the Zigbee endpoint and
      * cluster, corresponding to the resouce.
      * For virtual devices, the subtype is based on the resource.
      * @type {string}
      */
    this.subtype = subtype

    /** The derviced attributes of the resource type.
      * @type {DeconzDevice.TypeAttributes}
      */
    this.type = type

    /** Zigbee device vs virtual device.
      * @type {boolean}
      */
    this.zigbee = zigbee
  }
}

/** Derived attributes of a resource type.
  * @hideconstructor
  * @memberof DeconzDevice
  */
class TypeAttributes {
  constructor (category, serviceName, prio = 0) {
    /** The associated HomeKit Accessory category.
      * `null` for unknown types.
      * @type {?Accessory.Category}
      */
    this.category = category

    /** The name of the {@link DeconzService} to expose the resouce type.
      * `null` for unsupported types.
      * @type {string}
      */
    this.serviceName = serviceName

    /** The priority of the resource type when determining the primary service.
      * @type {integer}
      */
    this.prio = prio
  }
}

module.exports = DeconzDevice
