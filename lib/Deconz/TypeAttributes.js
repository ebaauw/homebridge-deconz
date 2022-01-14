// homebridge-deconz/lib/Deconz/TypeAttributes.js
// Copyright © 2022 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

/** Derived attributes of a resource type and `type` in the resource body.
  * @hideconstructor
  * @memberof Deconz
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

module.exports = TypeAttributes
