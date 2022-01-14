// homebridge-deconz/lib/Deconz/Resource.js
// Copyright © 2022 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

/** Delegate class for a resource on a deCONZ gateway.
  *
  * @memberof Deconz
  */
class Resource {
  /** Create a new instance of a delegate of a resource.
    *
    * @param {string} rtype - The resource type of the resource:
    * `groups`, `lights`, or `sensors`.
    * @param {integer} rid - The resource ID of the resource.
    * @param {object} body - The body of the resource.
    * @param {Deconz.ResourceAttributes} attrs - The derived attributes
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

module.exports = Resource
