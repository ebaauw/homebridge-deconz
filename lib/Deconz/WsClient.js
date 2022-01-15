// homebridge-deconz/lib/Deconz/WsClient.js
//
// Homebridge plug-in for deCONZ.
// Copyright © 2018-2022 Erik Baauw. All rights reserved.

'use strict'

const events = require('events')
const homebridgeLib = require('homebridge-lib')
const WebSocket = require('ws')

/** Client for web socket notifications by a deCONZ gateway.
  *
  * See the
  * [deCONZ](https://dresden-elektronik.github.io/deconz-rest-doc/endpoints/websocket/)
  * documentation for a better understanding of the web socket notifications.
  * @memberof Deconz
  */
class WsClient extends events.EventEmitter {
  /** Instantiate a new web socket client.
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
      retryTime: 15
    }
    const optionParser = new homebridgeLib.OptionParser(this.config)
    optionParser
      .hostKey()
      .intKey('retryTime', 0, 120)
      .boolKey('raw')
      .parse(params)
  }

  /** The hostname or IP address and port of the web socket server.
    * @type {string}
    */
  get host () { return this.config.hostname + ':' + this.config.port }
  set host (host) {
    const { hostname, port } = homebridgeLib.OptionParser.toHost('host', host)
    this.config.hostname = hostname
    this.config.port = port
  }

  /** Connect to the web socket server, and listen notifications.
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
        /** Emitted when connection to web socket server has been made.
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
                  if (obj.r !== null && obj.id !== null) {
                    let body
                    if (obj.state != null) {
                      body = { state: obj.state }
                    } else if (obj.config != null) {
                      body = { config: obj.config }
                    } else if (obj.attr != null) {
                      body = obj.attr
                    }
                    /** Emitted when a `changed` notification has been received.
                      *
                      * Note that the deCONZ gateway sends different
                      * notifications for top-level, `state`, and `config`
                      * attributes.
                      * Consequenly, the `body` only contains one of these.
                      * @event DeconzWsClient#changed
                      * @param {string} rtype - The resource type of the changed
                      * resource.
                      * @param {integer} rid - The resource ID of the changed
                      * resource.
                      * @param {object} body - The body of the changed resource.
                      */
                    this.emit('changed', obj.r, obj.id, body)
                    return
                  }
                  break
                case 'added':
                  if (obj.r !== null && obj.id !== null) {
                    /** Emitted when an `added` notification has been received.
                      * @event DeconzWsClient#added
                      * @param {string} rtype - The resource type of the added
                      * resource.
                      * @param {integer} rid - The resource ID of the added
                      * resource.
                      * @param {object} body - The body of the added resource.
                      */
                    this.emit('added', obj.r, obj.id, obj[obj.r.slice(0, -1)])
                    return
                  }
                  break
                case 'deleted':
                  if (obj.r !== null && obj.id !== null) {
                    /** Emitted when an `deleted` notification has been received.
                      * @event DeconzWsClient#deleted
                      * @param {string} rtype - The resource type of the deleted
                      * resource.
                      * @param {integer} rid - The resource ID of the deleted
                      * resource.
                      */
                    this.emit('deleted', obj.r, obj.id)
                    return
                  }
                  break
                case 'scene-called':
                  if (obj.gid != null && obj.scid != null) {
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
        if (this.ws != null) {
          this.ws.removeAllListeners()
          delete this.ws
        }
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

  /** Close the web socket connection.
    */
  async close () {
    if (this.ws != null) {
      this.reconnect = false
      this.ws.close()
      await events.once(this.ws, 'close')
    }
  }
}

module.exports = WsClient
