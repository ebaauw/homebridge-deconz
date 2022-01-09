// homebridge-deconz/lib/DeconzWsClient.js
//
// Homebridge plug-in for deCONZ.
// Copyright © 2018-2022 Erik Baauw. All rights reserved.

'use strict'

const events = require('events')
const homebridgeLib = require('homebridge-lib')
const WebSocket = require('ws')

/** Client for deCONZ web socket notifications.
  *
  * See the
  * [deCONZ](https://dresden-elektronik.github.io/deconz-rest-doc/endpoints/websocket/)
  * documentation for a better understanding of the web socket notifications.
  * @copyright © 2018-2021 Erik Baauw. All rights reserved.
  */
class DeconzWsClient extends events.EventEmitter {
  /** Create a new web socket client instance.
    * @param {object} params - Parameters.
    * @param {string} [params.host='localhost:443'] - IP address or hostname
    * and port of the web socket server.
    * @param {integer} [params.retryTime=10] - Time (in seconds) to try and
    * reconnect when the server connection has been closed.
    * @param {boolean} [params.raw=false] - Issue raw events instead of parsing
    * them.<br>
    * When specified, {@link DeconzWsClient#event:notification notification}
    * events are emitted, in lieu of {@link DeconzWsClient#event:changed changed},
    * {@link DeconzWsClient#event:added added}, and
    * {@link DeconzWsClient#event:sceneRecall sceneRecall} events.
    */
  constructor (params = {}) {
    super()
    this.config = {
      hostname: 'localhost',
      port: 443,
      retryTime: 10
    }
    const optionParser = new homebridgeLib.OptionParser(this.config)
    optionParser
      .hostKey()
      .intKey('retryTime', 0, 120)
      .boolKey('raw')
      .parse(params)
  }

  /** Websocket hostname and port.
    * @type {string}
    */
  get host () { return this.config.hostname + ':' + this.config.port }
  set host (host) {
    if (host !== this.host) {
      const { hostname, port } = homebridgeLib.optionParser.toHost(host)
      this.config.hostname = hostname
      this.config.port = port
    }
  }

  /** Listen for web socket notifications.
    */
  listen () {
    this.reconnect = true
    const url = 'ws://' + this.config.hostname + ':' + this.config.port
    this.ws = new WebSocket(url)

    this.ws
      .on('error', (error) => {
        /** Emitted on error.
          * @event DeconzWsClient#error
          * @param {Error} error - The error.
          */
        this.emit('error', error)
      })
      .on('open', () => {
        /** Emitted when connection to web socket server is opened.
          * @event DeconzWsClient#listening
          * @param {string} url - The URL of the web socket server.
          */
        this.emit('listening', url)
      })
      .on('message', (data, flags) => {
        try {
          const obj = JSON.parse(data.toString())
          if (!this.config.raw) {
            if (obj.r === 'groups' && obj.id === 0xFFF0.toString()) {
              // Workaround for deCONZ bug: events for `/groups/0` contain
              // the Zigbee group ID, instead of the resource ID.
              obj.id = '0'
            }
            if (obj.t === 'event') {
              switch (obj.e) {
                case 'changed':
                  if (obj.r && obj.id && obj.state) {
                    const resource = '/' + obj.r + '/' + obj.id + '/state'
                    /** Emitted when a `changed` notification has been received.
                      * @event DeconzWsClient#changed
                      * @param {string} resource - The changed resource.<br>
                      * This can be a `/lights`, `/groups`, or `/sensors`
                      * resource for top-level attributes, or a `state` or
                      * `config` sub-resource.
                      * @param {object} attributes - The top-level, `state`, or
                      * `config` attributes.
                      */
                    this.emit('changed', resource, obj.state)
                    return
                  }
                  if (obj.r && obj.id && obj.config) {
                    const resource = '/' + obj.r + '/' + obj.id + '/config'
                    this.emit('changed', resource, obj.config)
                    return
                  }
                  if (obj.r && obj.id && obj.attr) {
                    const resource = '/' + obj.r + '/' + obj.id
                    this.emit('changed', resource, obj.attr)
                    return
                  }
                  break
                case 'added':
                  if (obj.r && obj.id) {
                    const resource = '/' + obj.r + '/' + obj.id
                    /** Emitted when an `added` notification has been received.
                      * @event DeconzWsClient#added
                      * @param {string} resource - The added resource.
                      * @param {object} attributes - The full attributes of the
                      * added resource.
                      */
                    this.emit('added', resource, obj[obj.r.slice(0, -1)])
                    return
                  }
                  break
                case 'scene-called':
                  if (obj.gid && obj.scid) {
                    const resource = '/groups/' + obj.gid + '/scenes/' + obj.scid
                    /** Emitted when an `sceneRecall` notification has been received.
                      * @event DeconzWsClient#sceneRecall
                      * @param {string} resource - The scene resource.
                      */
                    this.emit('sceneRecall', resource)
                    return
                  }
                  break
                default:
                  break
              }
            }
          }
          /** Emitted when an unknown notification has been received, or when
            * `params.raw` was specified to the
            * {@link DeconzWsClient constructor}.
            * @event DeconzWsClient#notification
            * @param {object} notification - The raw notification.
            */
          this.emit('notification', obj)
        } catch (error) {
          this.emit('error', error)
        }
      })
      .on('close', async () => {
        this.ws.removeAllListeners()
        delete this.ws
        const retryTime = this.reconnect ? this.config.retryTime : 0
        /** Emitted when the connection to the web socket server has been closed.
          * @event DeconzWsClient#closed
          * @param {string} url - The URL of the web socket server.
          * @param {?int} retryTime - Time in seconds after which connection
          * will be retied automatically.
          */
        this.emit('closed', url, retryTime)
        if (retryTime > 0) {
          await homebridgeLib.timeout(retryTime * 1000)
          return this.listen()
        }
      })
  }

  /** Close the websocket.
    */
  async close () {
    if (this.ws != null) {
      this.reconnect = false
      this.ws.close()
      await events.once(this.ws, 'close')
    }
  }
}

module.exports = DeconzWsClient
