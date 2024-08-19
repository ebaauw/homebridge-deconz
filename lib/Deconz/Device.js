// homebridge-deconz/lib/Deconz/Device.js
// Copyright © 2022-2024 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

import { Deconz } from './index.js'

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
    * @param {Deconz.Resource} resource - The resource.
    */
  constructor (resource) {
    /** The device ID.
      *
      * This is the {@link Deconz.Resource#id id} of the delegates
      * of all resources for the device.
      * @type {string}
      */
    this.id = resource.id

    /** The key of the delegate for the primary resource for the device in
      * {@link DeconzDevice#resourceBySubtype resourceBySubtype}
      *
      * This is the {@link DeconzDevice.Resource#subtype subtype} of the
      * HomeKit service corresponding to the primary resource.
      * @type {string}
      */
    this.primary = resource.subtype

    /** An array of keys of the delegates for the resources for the device in
      * {@link DeconzDevice#resourceBySubtype resourceBySubtype} by service name.
      *
      * These are the {@link DeconzDevice.Resource#subtype subtype} values of the
      * HomeKit service corresponding to the resource.
      * @type {Object.<string, Array.<string>>}
      */
    this.subtypesByServiceName = {}
    this.subtypesByServiceName[resource.serviceName] = [resource.subtype]

    /** The delegates of the resources for the device, by subtype of the
      * corresponding HomeKit service.
      * @type {Object.<string, Deconz.Resource>}
      */
    this.resourceBySubtype = {}
    this.resourceBySubtype[resource.subtype] = resource

    /** Zigbee device vs virtual device.
      *
      * This is the {@link Deconz.Resource#zigbee zigbee} of the
      * delegates of all resources for the device.
      * @type {boolean}
      */
    this.zigbee = resource.zigbee
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
    * @param {Deconz.Resource} resource - The resource.
    */
  addResource (resource) {
    const { body, id, prio, rtype, subtype, zigbee } = resource
    if (this.resourceBySubtype[subtype] != null) {
      const r = this.resourceBySubtype[subtype]
      throw new Error(
        `${resource.rpath}: duplicate uniqueid ${body.uniqueid} in ${r.rpath}`
      )
    }
    if (zigbee !== this.zigbee || (zigbee && id !== this.id)) {
      const r = this.resourceBySubtype[subtype]
      throw new SyntaxError(
        `${resource.rpath}: cannot combine ${r.rpath}`
      )
    }
    if (this.subtypesByServiceName[resource.serviceName] == null) {
      this.subtypesByServiceName[resource.serviceName] = [resource.subtype]
    } else {
      this.subtypesByServiceName[resource.serviceName].push(resource.subtype)
    }
    this.resourceBySubtype[subtype] = resource
    const p = this.resourceBySubtype[this.primary]
    if (p.rtype === rtype && p.prio < prio) {
      this.primary = resource.subtype
    }
  }
}

Deconz.Device = Device
