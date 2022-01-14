// homebridge-deconz/lib/Deconz/ResourceAttributes.js
// Copyright © 2022 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

/** Derived attributes of a resource.
  * @hideconstructor
  * @memberof Deconz
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

module.exports = ResourceAttributes
