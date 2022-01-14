// homebridge-deconz/lib/Deconz/Device.js
// Copyright © 2022 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const Deconz = require('./index')

/** Delegate class for a Zigbee or virtual device on a deCONZ gateway.
  *
  * The deCONZ REST API exposes a Zigbee device using one or more resources.
  * These resources are linked to the device through the `uniqueid` in the
  * resource body.
  * Each supported device corresponds to a HomeKit accessory.
  * Each supported resource corresponds to a HomeKit service.
  * @memberof Deconz
  */
class Device {
  /** Create a new instance of a delegate of a device, from a resource.
    *
    * @param {string} rtype - The resource type of the resource:
    * `groups`, `lights`, or `sensors`.
    * @param {integer} rid - The resource ID of the resource.
    * @param {object} body - The body of the resource.
    * @param {Deconz.ResourceAttributes} attrs - The derived attributes
    * of the resource.
    */
  constructor (rtype, rid, body, attrs) {
    /** The device ID.
      *
      * This is the {@link Deconz.Resource#id id} of the delegates
      * of all resources for the device.
      * @type {string}
      */
    this.id = attrs.id

    /** Zigbee device vs virtual device.
      *
      * This is the {@link Deconz.Resource#zigbee zigbee} of the
      * delegates of all resources for the device.
      * @type {boolean}
      */
    this.zigbee = attrs.zigbee

    /** The delegates of the resources for the device, by subtype of the
      * corresponding HomeKit service.
      * @type {Object.<string, Deconz.Resource>}
      */
    this.resourceBySubtype = {}
  }

  /** The delegate of the primary resource of the device.
    * @type {Deconz.Resource}
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

  /** Add a {@link Deconz.Resource Resource}.
    *
    * Updates {@link Deconz.Device#resourceBySubtype resourceBySubtype},
    * {@link Deconz.Device#rpaths rpaths}, and, when the added resource
    * has a higher priority, {@link Deconz.Device#primary primary} and
    * {@link Deconz.Device#resource resource}.
    * @param {string} rtype - The resource type of the resource:
    * `groups`, `lights`, or `sensors`.
    * @param {integer} rid - The resource ID of the resource.
    * @param {object} body - The body of the resource.
    * @param {Deconz.ResourceAttributes} attrs - The derived attributes
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
    this.resourceBySubtype[subtype] = new Deconz.Resource(rtype, rid, body, attrs)
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

module.exports = Device
