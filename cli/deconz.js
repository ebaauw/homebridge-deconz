#!/usr/bin/env node

// homebridge-deconz/cli/deconz.js
// Copyright © 2018-2022 Erik Baauw. All rights reserved.
//
// Command line interface to deCONZ gateway.

'use strict'

const fs = require('fs')
const Deconz = require('../lib/Deconz')
const homebridgeLib = require('homebridge-lib')
const packageJson = require('../package.json')

const { b, u } = homebridgeLib.CommandLineTool
const { UsageError } = homebridgeLib.CommandLineParser

const usage = {
  deconz: `${b('deconz')} [${b('-hVDp')}] [${b('-H')} ${u('hostname')}[${b(':')}${u('port')}]] [${b('-K')} ${u('api key')}] [${b('-t')} ${u('timeout')}] ${u('command')} [${u('argument')} ...]`,

  get: `${b('get')} [${b('-hsnjuatlkv')}] [${u('path')}]`,
  put: `${b('put')} [${b('-hv')}] ${u('resource')} [${u('body')}]`,
  post: `${b('post')} [${b('-hv')}] ${u('resource')} [${u('body')}]`,
  delete: `${b('delete')} [${b('-hv')}] ${u('resource')} [${u('body')}]`,

  eventlog: `${b('eventlog')} [${b('-hnrs')}]`,

  discover: `${b('discover')} [${b('-hS')}]`,
  config: `${b('config')} [${b('-hs')}]`,
  description: `${b('description')} [${b('-hs')}]`,
  getApiKey: `${b('getApiKey')} [${b('-hv')}]`,
  unlock: `${b('unlock')} [${b('-hv')}]`,
  search: `${b('search')} [${b('-hv')}]`,

  probe: `${b('probe')} [${b('-hv')}] [${b('-t')} ${u('timeout')}] ${u('light')}`,
  restart: `${b('restart')} [${b('-hv')}]`
}
const description = {
  deconz: 'Command line interface to deCONZ gateway.',

  get: `Retrieve ${u('path')} from gateway.`,
  put: `Update ${u('resource')} on gateway with ${u('body')}.`,
  post: `Create ${u('resource')} on gateway with ${u('body')}.`,
  delete: `Delete ${u('resource')} from gateway with ${u('body')}.`,

  eventlog: 'Log web socket notifications by the gateway.',

  discover: 'Discover gateways.',
  config: 'Retrieve gateway configuration (unauthenticated).',
  description: 'Retrieve gateway description.',

  getApiKey: 'Obtain an API key for the gateway.',
  unlock: 'Unlock the gateway so new clients can obtain an API key.',
  search: 'Initiate a seach for new devices.',

  probe: `Probe ${u('light')} for supported colour (temperature) range.`,
  restart: 'Restart the gateway.'
}
const help = {
  deconz: `${description.deconz}

Usage: ${usage.deconz}

Parameters:
  ${b('-h')}, ${b('--help')}
  Print this help and exit.

  ${b('-V')}, ${b('--version')}
  Print version and exit.

  ${b('-D')}, ${b('--debug')}
  Print debug messages for communication with the gateway.

  ${b('-p')}, ${b('--phoscon')}
  Imitate the Phoscon app.

  ${b('-H')} ${u('hostname')}[${b(':')}${u('port')}], ${b('--host=')}${u('hostname')}[${b(':')}${u('port')}]
  Connect to ${u('hostname')}${b(':80')} or ${u('hostname')}${b(':')}${u('port')} instead of the default ${b('localhost:80')}.
  The hostname and port can also be specified by setting ${b('DECONZ_HOST')}.

  ${b('-K')} ${u('API key')}, ${b('--apiKey=')}${u('API key')}
  Use ${u('API key')} instead of the API key saved in ${b('~/.deconz')}.
  The API key can also be specified by setting ${b('DECONZ_API_KEY')}.

  ${b('-t')} ${u('timeout')}, ${b('--timeout=')}${u('timeout')}
  Set timeout to ${u('timeout')} seconds instead of default ${b(5)}.

Commands:
  ${usage.get}
  ${description.get}

  ${usage.put}
  ${description.put}

  ${usage.post}
  ${description.post}

  ${usage.delete}
  ${description.delete}

  ${usage.eventlog}
  ${description.eventlog}

  ${usage.discover}
  ${description.discover}

  ${usage.config}
  ${description.config}

  ${usage.description}
  ${description.description}

  ${usage.getApiKey}
  ${description.getApiKey}

  ${usage.unlock}
  ${description.unlock}

  ${usage.search}
  ${description.search}

  ${usage.probe}
  ${description.probe}

  ${usage.restart}
  ${description.restart}

For more help, issue: ${b('deconz')} ${u('command')} ${b('-h')}`,
  get: `${description.deconz}

Usage: ${b('deconz')} ${usage.get}

${description.get}

Parameters:
  ${b('-h')}, ${b('--help')}
  Print this help and exit.

  ${b('-s')}, ${b('--sortKeys')}
  Sort object key/value pairs alphabetically on key.

  ${b('-n')}, ${b('-noWhiteSpace')}
  Do not include spaces nor newlines in the output.

  ${b('-j')}, ${b('--jsonArray')}
  Output a JSON array of objects for each key/value pair.
  Each object contains two key/value pairs: key "keys" with an array
  of keys as value and key "value" with the value as value.

  ${b('-u')}, ${b('--joinKeys')}
  Output JSON array of objects for each key/value pair.
  Each object contains one key/value pair: the path (concatenated
  keys separated by '/') as key and the value as value.

  ${b('-a')}, ${b('--ascii')}
  Output path:value in plain text instead of JSON.

  ${b('-t')}, ${b('--topOnly')}
  Limit output to top-level key/values.

  ${b('-l')}, ${b('--leavesOnly')}
  Limit output to leaf (non-array, non-object) key/values.

  ${b('-k')}, ${b('--keysOnly')}
  Limit output to keys. With ${b('-u')}, output a JSON array of paths.

  ${b('-v')}, ${b('--valuesOnly')}
  Limit output to values. With ${b('-u')}, output a JSON array of values.

  ${u('path')}
  Path to retrieve from the gateway.`,
  put: `${description.deconz}

Usage: ${b('deconz')} ${usage.put}

${description.put}

Parameters:
  ${b('-h')}, ${b('--help')}
  Print this help and exit.

  ${b('-v')}, ${b('--verbose')}
  Print full API output.

  ${u('resource')}
  Resource to update.

  ${u('body')}
  Body in JSON.`,
  post: `${description.deconz}

Usage: ${b('deconz')} ${usage.post}

${description.post}

Parameters:
  ${b('-h')}, ${b('--help')}
  Print this help and exit.

  ${b('-v')}, ${b('--verbose')}
  Print full API output.

  ${u('resource')}
  Resource to create.

  ${u('body')}
  Body in JSON.`,
  delete: `${description.deconz}

Usage: ${b('deconz')} ${usage.delete}

${description.delete}

Parameters:
  ${b('-h')}, ${b('--help')}
  Print this help and exit.

  ${b('-v')}, ${b('--verbose')}
  Print full API output.

  ${u('resource')}
  Resource to delete.

  ${u('body')}
  Body in JSON.`,
  eventlog: `${description.deconz}

Usage: ${b('deconz')} ${usage.eventlog}

${description.eventlog}

Parameters:
  ${b('-h')}, ${b('--help')}
  Print this help and exit.

  ${b('-v')}, ${b('--verbose')}
  Print full API output.

  ${b('-n')}, ${b('--noRetry')}
  Do not retry when connection is closed.

  ${b('-r')}, ${b('--raw')}
  Do not parse events, output raw event data.

  ${b('-s')}, ${b('--service')}
  Do not output timestamps (useful when running as service).`,
  discover: `${description.deconz}

Usage: ${b('deconz')} ${usage.discover}

${description.discover}

Parameters:
  ${b('-h')}, ${b('--help')}
  Print this help and exit.

  ${b('-S')}, ${b('--stealth')}
  Stealth mode, only use local discovery.`,
  config: `${description.deconz}

Usage: ${b('deconz')} ${usage.config}

${description.config}

Parameters:
  ${b('-h')}, ${b('--help')}
  Print this help and exit.

  ${b('-s')}, ${b('--sortKeys')}
  Sort object key/value pairs alphabetically on key.`,
  description: `${description.deconz}

Usage: ${b('deconz')} ${usage.description}

${description.description}

Parameters:
  ${b('-h')}, ${b('--help')}
  Print this help and exit.

  ${b('-s')}, ${b('--sortKeys')}
  Sort object key/value pairs alphabetically on key.`,
  getApiKey: `${description.deconz}

Usage: ${b('deconz')} ${usage.getApiKey}

${description.getApiKey}
You need to unlock the deCONZ gateway prior to issuing this command,
unless you're running it on the gateway's local host.
The API key is saved to ${b('~/.deconz')}.

Parameters:
  ${b('-h')}, ${b('--help')}
  Print this help and exit.

  ${b('-v')}, ${b('--verbose')}
  Print full API output.`,
  unlock: `${description.deconz}

Usage: ${b('deconz')} ${usage.unlock}

${description.unlock}

Parameters:
  ${b('-h')}, ${b('--help')}
  Print this help and exit.

  ${b('-v')}, ${b('--verbose')}
  Print full API output.`,
  search: `${description.search}

Usage: ${b('deconz')} ${usage.search}

${description.search}

Parameters:
  ${b('-h')}, ${b('--help')}
  Print this help and exit.

  ${b('-v')}, ${b('--verbose')}
  Print full API output.`,
  probe: `${description.deconz}

Usage: ${b('deconz')} ${usage.probe}

${description.probe}

Parameters:
  ${b('-h')}, ${b('--help')}
  Print this help and exit.

  ${b('-v')}, ${b('--verbose')}
  Print full API output.

  ${b('-t')} ${u('timeout')}, ${b('--timeout=')}${u('timeout')}
  Timeout after ${u('timeout')} minutes (default: 5).

  ${u('light')}
  Lights resource to probe.`,
  restart: `${description.deconz}

Usage: ${b('deconz')} ${usage.restart}

${description.restart}

Parameters:
  ${b('-h')}, ${b('--help')}
  Print this help and exit.

  ${b('-v')}, ${b('--verbose')}
  Print full API output.`
}

class Main extends homebridgeLib.CommandLineTool {
  constructor () {
    super({ mode: 'command', debug: false })
    this.usage = usage.deconz
    try {
      this.readGateways()
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.error(error)
      }
      this.gateways = {}
    }
  }

  // ===========================================================================

  readGateways () {
    const text = fs.readFileSync(process.env.HOME + '/.deconz')
    try {
      this.gateways = JSON.parse(text)
    } catch (error) {
      this.warn('%s/.deconz: file corrupted', process.env.HOME)
      this.gateways = {}
    }
  }

  writeGateways () {
    const jsonFormatter = new homebridgeLib.JsonFormatter(
      { noWhiteSpace: true, sortKeys: true }
    )
    const text = jsonFormatter.stringify(this.gateways)
    fs.writeFileSync(process.env.HOME + '/.deconz', text, { mode: 0o600 })
  }

  parseArguments () {
    const parser = new homebridgeLib.CommandLineParser(packageJson)
    const clargs = {
      options: {
        host: process.env.DECONZ_HOST || 'localhost',
        timeout: 5
      }
    }
    parser
      .help('h', 'help', help.deconz)
      .version('V', 'version')
      .option('H', 'host', (value) => {
        homebridgeLib.OptionParser.toHost('host', value, false, true)
        clargs.options.host = value
      })
      .option('K', 'apiKey', (value) => {
        clargs.options.apiKey = homebridgeLib.OptionParser.toString(
          'apiKey', value, true, true
        )
      })
      .flag('p', 'phoscon', () => {
        clargs.options.phoscon = true
      })
      .flag('D', 'debug', () => {
        if (this.debugEnabled) {
          this.setOptions({ vdebug: true })
        } else {
          this.setOptions({ debug: true, chalk: true })
        }
      })
      .option('t', 'timeout', (value) => {
        clargs.options.timeout = homebridgeLib.OptionParser.toInt(
          'timeout', value, 1, 60, true
        )
      })
      .parameter('command', (value) => {
        if (usage[value] == null || typeof this[value] !== 'function') {
          throw new UsageError(`${value}: unknown command`)
        }
        clargs.command = value
      })
      .remaining((list) => { clargs.args = list })
    parser
      .parse()
    return clargs
  }

  async main () {
    try {
      await this._main()
    } catch (error) {
      if (error.request == null) {
        this.error(error)
      }
    }
  }

  async _main () {
    this.clargs = this.parseArguments()
    this.deconzDiscovery = new Deconz.Discovery({
      timeout: this.clargs.options.timeout
    })
    this.deconzDiscovery
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
        this.vdebug(
          '%s: request %d: %s %s', request.name,
          request.id, request.method, request.url
        )
      })
      .on('response', (response) => {
        this.vdebug(
          '%s: request %d: response: %j', response.request.name,
          response.request.id, response.body
        )
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

    if (this.clargs.command === 'discover') {
      return this.discover(this.clargs.args)
    }
    try {
      this.gatewayConfig = await this.deconzDiscovery.config(
        this.clargs.options.host
      )
    } catch (error) {
      if (error.request == null) {
        await this.fatal('%s: %s', this.clargs.options.host, error)
      }
      await this.fatal('%s: deCONZ gateway not found', this.clargs.options.host)
    }

    this.name = 'deconz ' + this.clargs.command
    this.usage = `${b('deconz')} ${usage[this.clargs.command]}`

    if (this.clargs.command === 'config' || this.clargs.command === 'description') {
      return this[this.clargs.command](this.clargs.args)
    }

    this.bridgeid = this.gatewayConfig.bridgeid
    if (this.clargs.options.apiKey == null) {
      if (
        this.gateways[this.bridgeid] != null &&
        this.gateways[this.bridgeid].apiKey != null
      ) {
        this.clargs.options.apiKey = this.gateways[this.bridgeid].apiKey
      } else if (process.env.DECONZ_API_KEY != null) {
        this.clargs.options.apiKey = process.env.DECONZ_API_KEY
      }
    }
    if (this.clargs.options.apiKey == null && this.clargs.command !== 'getApiKey') {
      let args = ''
      if (
        this.clargs.options.host !== 'localhost' &&
        this.clargs.options.host !== process.env.DECONZ_HOST
      ) {
        args += ' -H ' + this.clargs.options.host
      }
      await this.fatal(
        'missing API key - unlock gateway and run "deconz%s getApiKey"', args
      )
    }
    this.client = new Deconz.ApiClient(this.clargs.options)
    this.client
      .on('error', (error) => {
        if (error.request.id !== this.requestId) {
          if (error.request.body == null) {
            this.log(
              'request %d: %s %s', error.request.id,
              error.request.method, error.request.resource
            )
          } else {
            this.log(
              'request %d: %s %s %s', error.request.id,
              error.request.method, error.request.resource, error.request.body
            )
          }
          this.requestId = error.request.id
        }
        if (error.nonCritical) {
          this.warn('request %d: %s', error.request.id, error)
        } else {
          this.error('request %d: %s', error.request.id, error)
        }
      })
      .on('request', (request) => {
        if (request.body == null) {
          this.debug(
            'request %d: %s %s', request.id, request.method, request.resource
          )
          this.vdebug(
            'request %d: %s %s', request.id, request.method, request.url
          )
        } else {
          this.debug(
            'request %d: %s %s %s', request.id,
            request.method, request.resource, request.body
          )
          this.vdebug(
            'request %d: %s %s %s', request.id,
            request.method, request.url, request.body
          )
        }
      })
      .on('response', (response) => {
        this.vdebug(
          'request %d: response: %j', response.request.id, response.body
        )
        this.debug(
          'request %d: %d %s', response.request.id,
          response.statusCode, response.statusMessage
        )
      })
    return this[this.clargs.command](this.clargs.args)
  }

  // ===== GET =================================================================

  async get (...args) {
    const parser = new homebridgeLib.CommandLineParser(packageJson)
    const clargs = {
      options: {}
    }
    parser
      .help('h', 'help', help.get)
      .flag('s', 'sortKeys', () => { clargs.options.sortKeys = true })
      .flag('n', 'noWhiteSpace', () => {
        clargs.options.noWhiteSpace = true
      })
      .flag('j', 'jsonArray', () => { clargs.options.noWhiteSpace = true })
      .flag('u', 'joinKeys', () => { clargs.options.joinKeys = true })
      .flag('a', 'ascii', () => { clargs.options.ascii = true })
      .flag('t', 'topOnly', () => { clargs.options.topOnly = true })
      .flag('l', 'leavesOnly', () => { clargs.options.leavesOnly = true })
      .flag('k', 'keysOnly', () => { clargs.options.keysOnly = true })
      .flag('v', 'valuesOnly', () => { clargs.options.valuesOnly = true })
      .remaining((list) => {
        if (list.length > 1) {
          throw new UsageError('too many paramters')
        }
        clargs.resource = list.length === 0
          ? '/'
          : homebridgeLib.OptionParser.toPath('resource', list[0])
      })
      .parse(...args)
    const jsonFormatter = new homebridgeLib.JsonFormatter(clargs.options)
    const response = await this.client.get(clargs.resource)
    this.print(jsonFormatter.stringify(response))
  }

  // ===== PUT, POST, DELETE ===================================================

  async resourceCommand (command, ...args) {
    const parser = new homebridgeLib.CommandLineParser(packageJson)
    const clargs = {
      options: {}
    }
    parser
      .help('h', 'help', help[command])
      .flag('v', 'verbose', () => { clargs.options.verbose = true })
      .parameter('resource', (resource) => {
        clargs.resource = homebridgeLib.OptionParser.toPath('resource', resource)
        if (clargs.resource === '/') {
          // deCONZ will crash otherwise, see deconz-rest-plugin#2520.
          throw new UsageError(`/: invalid resource for ${command}`)
        }
      })
      .remaining((list) => {
        if (list.length > 1) {
          throw new Error('too many paramters')
        }
        if (list.length === 1) {
          try {
            clargs.body = JSON.parse(list[0])
          } catch (error) {
            throw new Error(error.message) // Covert TypeError to Error.
          }
        }
      })
      .parse(...args)
    const response = await this.client[command](clargs.resource, clargs.body)
    const jsonFormatter = new homebridgeLib.JsonFormatter()
    if (clargs.options.verbose || response.success == null) {
      this.print(jsonFormatter.stringify(response.body))
      return
    }
    if (command !== 'put') {
      if (response.success.id != null) {
        this.print(jsonFormatter.stringify(response.success.id))
      } else {
        this.print(jsonFormatter.stringify(response.success))
      }
      return
    }
    this.print(jsonFormatter.stringify(response.success))
  }

  async put (...args) {
    return this.resourceCommand('put', ...args)
  }

  async post (...args) {
    return this.resourceCommand('post', ...args)
  }

  async delete (...args) {
    return this.resourceCommand('delete', ...args)
  }

  // ===========================================================================

  async destroy () {
    if (this.wsMonitor != null) {
      await this.wsMonitor.close()
    }
    if (this.eventStream != null) {
      await this.eventStream.close()
    }
  }

  async eventlog (...args) {
    const parser = new homebridgeLib.CommandLineParser(packageJson)
    let mode = 'daemon'
    const options = {}
    parser
      .help('h', 'help', help.eventlog)
      .flag('n', 'noRetry', () => { options.retryTime = 0 })
      .flag('r', 'raw', () => { options.raw = true })
      .flag('s', 'service', () => { mode = 'service' })
      .parse(...args)
    this.jsonFormatter = new homebridgeLib.JsonFormatter(
      mode === 'service' ? { noWhiteSpace: true } : {}
    )
    const { websocketport } = await this.client.get('/config')
    options.host = this.client.host + ':' + websocketport
    this.wsMonitor = new Deconz.WsClient(options)
    this.setOptions({ mode })
    this.wsMonitor
      .on('error', (error) => { this.error(error) })
      .on('listening', (url) => { this.log('listening on %s', url) })
      .on('closed', (url) => { this.log('connection to %s closed', url) })
      .on('changed', (rtype, rid, body) => {
        let resource = '/' + rtype + '/' + rid
        if (Object.keys(body).length === 1) {
          if (body.state != null) {
            resource += '/state'
            body = body.state
          } else if (body.config != null) {
            resource += '/config'
            body = body.config
          }
        }
        this.log('%s: %s', resource, this.jsonFormatter.stringify(body))
      })
      .on('added', (rtype, rid, body) => {
        this.log(
          '/%s/%d: added: %s', rtype, rid, this.jsonFormatter.stringify(body)
        )
      })
      .on('sceneRecall', (resource) => {
        this.log('%s: recall', resource)
      })
      .on('notification', (body) => {
        this.log(this.jsonFormatter.stringify(body))
      })
      .listen()
  }

  // ===========================================================================

  async simpleCommand (command, ...args) {
    const parser = new homebridgeLib.CommandLineParser(packageJson)
    const clargs = {
      options: {}
    }
    parser
      .help('h', 'help', help[command])
      .flag('v', 'verbose', () => { clargs.options.verbose = true })
      .parse(...args)
    const response = await this.client[command]()
    const jsonFormatter = new homebridgeLib.JsonFormatter()
    for (const error of response.errors) {
      this.warn('api error %d: %s', error.type, error.description)
    }
    if (clargs.options.verbose || response.success == null) {
      this.print(jsonFormatter.stringify(response.body))
      return
    }
    if (response.success.id != null) {
      this.print(jsonFormatter.stringify(response.success.id))
      return
    }
    if (response.success != null) {
      this.print(jsonFormatter.stringify(response.success))
      return
    }
    this.print(jsonFormatter.stringify(response.body))
  }

  async discover (...args) {
    const parser = new homebridgeLib.CommandLineParser(packageJson)
    let stealth = false
    parser
      .help('h', 'help', help.discover)
      .flag('S', 'stealth', () => { stealth = true })
      .parse(...args)
    const jsonFormatter = new homebridgeLib.JsonFormatter({ sortKeys: true })
    const bridges = await this.deconzDiscovery.discover(stealth)
    this.print(jsonFormatter.stringify(bridges))
  }

  async config (...args) {
    const parser = new homebridgeLib.CommandLineParser(packageJson)
    const options = {}
    parser
      .help('h', 'help', help.config)
      .flag('s', 'sortKeys', () => { options.sortKeys = true })
      .parse(...args)
    const jsonFormatter = new homebridgeLib.JsonFormatter(options)
    const json = jsonFormatter.stringify(this.gatewayConfig)
    this.print(json)
  }

  async description (...args) {
    const parser = new homebridgeLib.CommandLineParser(packageJson)
    const options = {}
    parser
      .help('h', 'help', help.description)
      .flag('s', 'sortKeys', () => { options.sortKeys = true })
      .parse(...args)
    const response = await this.deconzDiscovery.description(this.clargs.options.host)
    const jsonFormatter = new homebridgeLib.JsonFormatter(options)
    const json = jsonFormatter.stringify(response)
    this.print(json)
  }

  async getApiKey (...args) {
    const parser = new homebridgeLib.CommandLineParser(packageJson)
    const jsonFormatter = new homebridgeLib.JsonFormatter(
      { noWhiteSpace: true, sortKeys: true }
    )
    parser
      .help('h', 'help', help.getApiKey)
      .parse(...args)
    const apiKey = await this.client.getApiKey('deconz')
    this.print(jsonFormatter.stringify(apiKey))
    this.gateways[this.bridgeid] = { apiKey }
    if (this.client.fingerprint != null) {
      this.gateways[this.bridgeid].fingerprint = this.client.fingerprint
    }
    this.writeGateways()
  }

  async unlock (...args) {
    return this.simpleCommand('unlock', ...args)
  }

  async search (...args) {
    return this.simpleCommand('search', ...args)
  }

  // ===== LIGHTVALUES =========================================================

  async probe (...args) {
    const parser = new homebridgeLib.CommandLineParser(packageJson)
    const clargs = {
      maxCount: 60
    }
    parser
      .help('h', 'help', help.probe)
      .flag('v', 'verbose', () => { clargs.verbose = true })
      .option('t', 'timeout', (value, key) => {
        homebridgeLib.OptionParser.toInt(
          'timeout', value, 1, 10, true
        )
        clargs.maxCount = value * 12
      })
      .parameter('light', (value) => {
        if (value.substring(0, 8) !== '/lights/') {
          throw new UsageError(`${value}: invalid light`)
        }
        clargs.light = value
      })
      .parse(...args)
    const light = await this.client.get(clargs.light)

    async function probeCt (name, value) {
      clargs.verbose && this.log(`${clargs.light}: ${name} ...\\c`)
      await this.client.put(clargs.light + '/state', { ct: value })
      let count = 0
      return new Promise((resolve, reject) => {
        const interval = setInterval(async () => {
          const ct = await this.client.get(clargs.light + '/state/ct')
          if (ct !== value || ++count > clargs.maxCount) {
            clearInterval(interval)
            clargs.verbose && this.logc(
              count > clargs.maxCount ? ' timeout' : ' done'
            )
            return resolve(ct)
          }
          clargs.verbose && this.logc('.\\c')
        }, 5000)
      })
    }

    function round (f) {
      return Math.round(f * 10000) / 10000
    }

    async function probeXy (name, value) {
      clargs.verbose && this.log(`${clargs.light}: ${name} ...\\c`)
      await this.client.put(clargs.light + '/state', { xy: value })
      let count = 0
      return new Promise((resolve, reject) => {
        const interval = setInterval(async () => {
          let xy = await this.client.get(clargs.light + '/state/xy')
          if (this.client.isDeconz) {
            xy = [round(xy[0]), round(xy[1])]
          }
          if (
            xy[0] !== value[0] || xy[1] !== value[1] ||
            ++count > clargs.maxCount
          ) {
            clearInterval(interval)
            clargs.verbose && this.logc(
              count > clargs.maxCount ? ' timeout' : ' done'
            )
            return resolve(xy)
          }
          clargs.verbose && this.logc('.\\c')
        }, 5000)
      })
    }

    this.verbose && this.log(
      '%s: %s %s %s "%s"', clargs.light, light.manufacturername,
      light.modelid, light.type, light.name
    )
    const response = {
      manufacturername: light.manufacturername,
      modelid: light.modelid,
      type: light.type,
      bri: light.state.bri != null
    }
    await this.client.put(clargs.light + '/state', { on: true })
    if (light.state.ct != null) {
      response.ct = {}
      response.ct.min = await probeCt.call(this, 'cool', 1)
      response.ct.max = await probeCt.call(this, 'warm', 1000)
    }
    if (light.state.xy != null) {
      const zero = 0.0001
      const one = 0.9961
      response.xy = {}
      response.xy.r = await probeXy.call(this, 'red', [one, zero])
      response.xy.g = await probeXy.call(this, 'green', [zero, one])
      response.xy.b = await probeXy.call(this, 'blue', [zero, zero])
    }
    await this.client.put(clargs.light + '/state', { on: light.state.on })
    this.jsonFormatter = new homebridgeLib.JsonFormatter()
    const json = this.jsonFormatter.stringify(response)
    this.print(json)
  }

  // ===== BRIDGE/GATEWAY DISCOVERY ==============================================

  async restart (...args) {
    const parser = new homebridgeLib.CommandLineParser(packageJson)
    const clargs = {}
    parser
      .help('h', 'help', help.restart)
      .flag('v', 'verbose', () => { clargs.verbose = true })
      .parse(...args)
    if (this.client.isHue) {
      const response = await this.client.put('/config', { reboot: true })
      if (!response.success.reboot) {
        return false
      }
    } else if (this.client.isDeconz) {
      const response = await this.client.post('/config/restartapp')
      if (!response.success.restartapp) {
        return false
      }
    } else {
      await this.fatal('restart: only supported for Hue bridge or deCONZ gateway')
    }
    clargs.verbose && this.log('restarting ...\\c')
    return new Promise((resolve, reject) => {
      let busy = false
      const interval = setInterval(async () => {
        try {
          if (!busy) {
            busy = true
            const bridgeid = await this.client.get('/config/bridgeid')
            if (bridgeid === this.bridgeid) {
              clearInterval(interval)
              clargs.verbose && this.logc(' done')
              return resolve(true)
            }
            busy = false
          }
        } catch (error) {
          busy = false
        }
        clargs.verbose && this.logc('.\\c')
      }, 2500)
    })
  }
}

new Main().main()
