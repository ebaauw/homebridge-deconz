// homebridge-deconz/lib/DeconzPlatform.js
// Copyright © 2022 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const events = require('events')
const homebridgeLib = require('homebridge-lib')
const Deconz = require('./Deconz')
const DeconzAccessory = require('./DeconzAccessory')

class DeconzPlatform extends homebridgeLib.Platform {
  constructor (log, configJson, homebridge, bridge) {
    super(log, configJson, homebridge)
    this.parseConfigJson(configJson)
    this.debug('config: %j', this.config)

    this.initJobs = []
    this
      .on('accessoryRestored', this.accessoryRestored)
      .once('heartbeat', this.init)
      .on('heartbeat', this.heartbeat)
  }

  parseConfigJson (configJson) {
    this.config = {
      forceHttp: false,
      hosts: [],
      noResponse: false,
      parallelRequests: 10,
      stealth: false,
      timeout: 5,
      waitTimePut: 50,
      waitTimePutGroup: 1000,
      waitTimeResend: 300,
      waitTimeReset: 500,
      waitTimeUpdate: 100
    }
    const optionParser = new homebridgeLib.OptionParser(this.config, true)
    optionParser
      .on('userInputError', (message) => {
        this.warn('config.json: %s', message)
      })
      .stringKey('name')
      .stringKey('platform')
      .boolKey('forceHttp')
      .arrayKey('hosts')
      .boolKey('noResponse')
      .intKey('parallelRequests', 1, 30)
      .boolKey('stealth')
      .intKey('timeout', 5, 30)
      .intKey('waitTimePut', 0, 50)
      .intKey('waitTimePutGroup', 0, 1000)
      .intKey('waitTimeResend', 100, 1000)
      .boolKey('waitTimeReset', 10, 2000)
      .intKey('waitTimeUpdate', 0, 500)

    this.gatewayMap = {}

    try {
      optionParser.parse(configJson)
      this.discovery = new Deconz.Discovery({
        forceHttp: this.config.forceHttp,
        timeout: this.config.timeout
      })
      this.discovery
        .on('error', (error) => {
          this.log(
            '%s: request %d: %s %s', error.request.name,
            error.request.id, error.request.method, error.request.resource
          )
          this.warn(
            '%s: request %d: %s', error.request.name, error.request.id, error
          )
        })
        .on('request', (request) => {
          this.debug(
            '%s: request %d: %s %s', request.name,
            request.id, request.method, request.resource
          )
        })
        .on('response', (response) => {
          this.debug(
            '%s: request %d: %d %s', response.request.name,
            response.request.id, response.statusCode, response.statusMessage
          )
        })
        .on('found', (name, id, address) => {
          this.debug('%s: found %s at %s', name, id, address)
        })
        .on('searching', (host) => {
          this.debug('upnp: listening on %s', host)
        })
        .on('searchDone', () => { this.debug('upnp: search done') })
    } catch (error) {
      this.error(error)
    }
  }

  async foundGateway (host, config) {
    const id = config.bridgeid
    if (this.gatewayMap[id] == null) {
      this.gatewayMap[id] = new DeconzAccessory.Gateway(this, {
        config: config,
        host: host
      })
    }
    this.gatewayMap[id].found(host, config)
    this.emit('found')
  }

  async findHost (host) {
    try {
      const config = await this.discovery.config(host)
      await this.foundGateway(host, config)
    } catch (error) {
      this.warn('%s: %s - retrying in 60s', host, error)
      await homebridgeLib.timeout(60000)
      return this.findHost(host)
    }
  }

  async init () {
    try {
      const jobs = []
      this.debug('job %d: find at least one gateway', jobs.length)
      jobs.push(events.once(this, 'found'))
      if (this.config.hosts.length > 0) {
        for (const host of this.config.hosts) {
          this.debug('job %d: find gateway at %s', jobs.length, host)
          jobs.push(this.findHost(host))
        }
      } else {
        for (const id in this.gatewayMap) {
          this.debug('job %d: find gateway %s', jobs.length, id)
          jobs.push(this.gatewayMap[id].init())
        }
      }

      this.debug('waiting for %d jobs', jobs.length)
      for (const id in jobs) {
        try {
          await jobs[id]
          this.debug('job %d/%d: done', Number(id) + 1, jobs.length)
        } catch (error) {
          this.warn(error)
        }
      }

      this.log('%d gateways', Object.keys(this.gatewayMap).length)
      this.emit('initialised')
    } catch (error) { this.error(error) }
  }

  async heartbeat (beat) {
    try {
      if (beat % 300 === 5 && this.config.hosts.length === 0) {
        const configs = await this.discovery.discover()
        const jobs = []
        for (const host in configs) {
          jobs.push(this.foundGateway(host, configs[host]))
        }
        for (const job of jobs) {
          try {
            await job
          } catch (error) {
            this.error(error)
          }
        }
      }
    } catch (error) { this.error(error) }
  }

  /** Called when an accessory has been restored.
    *
    * Re-create {@link DeconzAccessory.Gateway Gateway} delegates for restored
    * gateway accessories.
    * Accessories for devices exposed by the gateway will be restored from
    * the gateway context, once Homebridge has started it's HAP server.
    */
  accessoryRestored (className, version, id, name, context) {
    try {
      if (className === 'Gateway') {
        if (
          this.config.hosts.length === 0 ||
          this.config.hosts.includes(context.host)
        ) {
          this.gatewayMap[id] = new DeconzAccessory.Gateway(this, context)
        }
      } else {
        const gateway = this.gatewayMap[context.gid]
        if (gateway != null) {
          gateway.addAccessory(id)
        }
      }
    } catch (error) { this.error(error) }
  }
}

module.exports = DeconzPlatform
