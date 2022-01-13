// homebridge-deconz/lib/DeconzDevice.js
// Copyright © 2022 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

/** Delegate class for a Zigbee or virtual device on a deCONZ gateway.
  *
  * The deCONZ REST API exposes a Zigbee device using one or more resources.
  * These resources are linked to the device through the `uniqueid` in the
  * resource body.
  * Each supported device corresponds to a HomeKit accessory.
  * Each supported resource corresponds to a HomeKit service.
  */
class DeconzDevice {
  static get Resource () { return Resource }
  static get ResourceAttributes () { return ResourceAttributes }
  static get TypeAttributes () { return TypeAttributes }

  /** Create a new instance of a delegate of a device, from a resource.
    *
    * @param {string} rtype - The resource type of the resource:
    * `groups`, `lights`, or `sensors`.
    * @param {integer} rid - The resource ID of the resource.
    * @param {object} body - The body of the resource.
    * @param {DeconzDevice.ResourceAttributes} attrs - The derived attributes
    * of the resource.
    */
  constructor (rtype, rid, body, attrs) {
    /** The device ID.
      *
      * This is the {@link DeconzDevice.Resource#id id} of the delegates
      * of all resources for the device.
      * @type {string}
      */
    this.id = attrs.id

    /** Zigbee device vs virtual device.
      *
      * This is the {@link DeconzDevice.Resource#zigbee zigbee} of the
      * delegates of all resources for the device.
      * @type {boolean}
      */
    this.zigbee = attrs.zigbee

    /** The delegates of the resources for the device, by subtype of the
      * corresponding HomeKit service.
      * @type {Object.<string, DeconzDevice.Resource>}
      */
    this.resourceBySubtype = {}
  }

  /** The delegate of the primary resource of the device.
    * @type {DeconzDevice.Resource}
    */
  get resource () { return this.resourceBySubtype[this.primary] }

  /** List of resource paths of the resources for the device.
    * @type {string[]}
    */
  get rpaths () {
    return Object.keys(this.resourceBySubtype || {}).map((subtype) => {
      return this.resourceBySubtype[subtype].rpath
    })
  }

  /** Add a {@link DeconzDevice.Resource Resource}.
    *
    * Updates {@link DeconzDevice#resourceBySubtype resourceBySubtype},
    * {@link DeconzDevice#rpaths rpaths}, and, when the added resource
    * has a higher priority, {@link DeconzDevice#primary primary} and
    * {@link DeconzDevice#resource resource}.
    * @param {string} rtype - The resource type of the resource:
    * `groups`, `lights`, or `sensors`.
    * @param {integer} rid - The resource ID of the resource.
    * @param {object} body - The body of the resource.
    * @param {DeconzDevice.ResourceAttributes} attrs - The derived attributes
    * of the resource.
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
        this.resource.rtype === rtype && this.resource.prio < attrs.prio
      )
    ) {
      /** The key of the delegate for the primary resource for the device in
        * {@link DeconzDevice#resourceBySubtype resourceBySubtype}
        *
        * This is the {@link DeconzDevice.Resource#subtype subtype} of the
        * HomeKit service corresponding to the primary resource.
        * @type {string}
        */
      this.primary = subtype
    }
    return this.resourceBySubtype[subtype]
  }
}

/** Delegate class for a resource.
  *
  * @memberof DeconzDevice
  */
class Resource {
  /** Create a new instance of a delegate of a resource.
    *
    * @param {string} rtype - The resource type of the resource:
    * `groups`, `lights`, or `sensors`.
    * @param {integer} rid - The resource ID of the resource.
    * @param {object} body - The body of the resource.
    * @param {DeconzDevice.ResourceAttributes} attrs - The derived attributes
    * of the resource.
    */
  constructor (rtype, rid, body, attrs) {
    /** The resource type of the resource: `groups`, `lights`, or `sensors`.
      * @type {string}
      */
    this.rtype = rtype

    /** The resource ID of the resource.
      * @type {integer}
      */
    this.rid = rid

    /** The body of the resource.
      * @type {object}
      */
    this.body = body

    this.attrs = attrs
  }

  /** The category of the corresponding HomeKit accessory, or `null` for
    * unknown resources.
    * @type {?Accessory.Category}
    * @readonly
    */
  get category () { return this.attrs.type.category }

  /** The device ID.
    *
    * For Zigbee devices, the device ID is based on the Zigbee mac address
    * of the device, from the `uniqueid` in the body of the resource.
    * For virtual devices, the device ID is based on the Zigbee mac address of
    * the gateway, and on the resource type and resource ID of the resource.
    * The UUID of the corresponding HomeKit accessory is based on the device ID.
    * @type {string}
    */
  get id () { return this.attrs.id }

  /** The priority of the resource, when determining the primary resource for a
    * device.
    * @type {integer}
    */
  get prio () { return this.attrs.type.prio }

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
    * This is derived from the resource type and `type` in the resource body.
    * @type {string}
    */
  get serviceName () { return this.attrs.type.serviceName }

  /** The subtype of the corresponding HomeKit service.
    *
    * For Zigbee devices, the subtype is based on the Zigbee endpoint and
    * cluster, from the `uniqueid` in the body of the resource.
    * For virtual devices, the subtype is based on the resource type and
    * resource ID.
    * @type {string}
    */
  get subtype () { return this.attrs.subtype }

  /** Zigbee device vs virtual device.
    *
    * Derived from the resource type and, for `sensors`, on the `type` in the
    * resource body.
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
    /** The device ID.
      *
      * For Zigbee devices, the device ID is based on the Zigbee mac address
      * of the device, from the `uniqueid` in the body of the resource.
      * For virtual devices, the device ID is based on the Zigbee mac address of
      * the gateway, and on the resource type and resource ID of the resource.
      * The UUID of the corresponding HomeKit accessory is based on the
      * device ID.
      * @type {string}
      */
    this.id = id

    /** The subtype of the corresponding HomeKit service.
      *
      * For Zigbee devices, the subtype is based on the Zigbee endpoint and
      * cluster, from the `uniqueid` in the body of the resource.
      * For virtual devices, the subtype is based on the resource type and
      * resource ID.
      * @type {string}
      */
    this.subtype = subtype

    /** The derived attributes of the resource type and `type` in the resource
      * body.
      * @type {DeconzDevice.TypeAttributes}
      */
    this.type = type

    /** Zigbee device vs virtual device.
      *
      * Derived from the resource type and, for `sensors`, on the `type` in the
      * resource body.
      * @type {boolean}
      */
    this.zigbee = zigbee
  }
}

/** Derived attributes of a resource type and `type` in the resource body.
  * @hideconstructor
  * @memberof DeconzDevice
  */
class TypeAttributes {
  constructor (category, serviceName, prio = 0) {
    /** The category of the corresponding HomeKit accessory, or `null` for
      * unknown resources.
      * @type {?Accessory.Category}
      */
    this.category = category

    /** The name of the {@link DeconzService} subclass of the delegate of the
      * corresponding HomeKit service, or `null` for unsupported and unknown
      * resources.
      * @type {string}
      */
    this.serviceName = serviceName

    /** The priority of the resource, when determining the primary resource
      * for a device.
      * @type {integer}
      */
    this.prio = prio
  }
}

module.exports = DeconzDevice
