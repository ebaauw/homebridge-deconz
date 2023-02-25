#!/usr/bin/env node

// homebridge-deconz/cli/deconz.js
// Copyright © 2018-2023 Erik Baauw. All rights reserved.
//
// Command line interface to Homebridge deCONZ UI Server.

'use strict'

const fs = require('fs').promises
// const Deconz = require('../lib/Deconz')
const {
  CommandLineParser, CommandLineTool, HttpClient, JsonFormatter, OptionParser
} = require('hb-lib-tools')
const packageJson = require('../package.json')

const { b, u } = CommandLineTool
const { UsageError } = CommandLineParser

const usage = {
  ui: `${b('ui')} [${b('-hVD')}] [${b('-U')} ${u('username')}] [${b('-G')} ${u('gateway')}] [${b('-t')} ${u('timeout')}] ${u('command')} [${u('argument')} ...]`,
  discover: `${b('discover')} [${b('-hsnjuatlkv')}]`,
  get: `${b('get')} [${b('-hsnjuatlkv')}] ${u('resource')}`,
  put: `${b('put')} [${b('-h')}] ${u('resource')} ${u('body')}`
}

const description = {
  ui: 'Command line interface to Homebridge deCONZ UI Server for dynamic settings.',
  discover: 'Discover UI servers and gateways.',
  get: 'Get dynamic settings.',
  put: 'Update dynamic settings.'
}

const help = {
  ui: `${description.ui}

Usage: ${usage.ui}

Parameters:
  ${b('-h')}, ${b('--help')}
  Print this help and exit.

  ${b('-V')}, ${b('--version')}
  Print version and exit.

  ${b('-D')}, ${b('--debug')}
  Print debug messages for communication with the Homebridge deCONZ UI Server.

  ${b('-U')} ${u('username')}, ${b('--username=')}${u('username')}
  Specify the username of the Homebridge instance.  Default: first instance in config.json.

  ${b('-G')} ${u('gateway')}, ${b('--gateway=')}${u('gateway')}
  Specify the id of the deCONZ gateway.  Default: first gateway in cachedAccessories.

  ${b('-t')} ${u('timeout')}, ${b('--timeout=')}${u('timeout')}
  Set timeout to ${u('timeout')} seconds instead of default ${b(5)}.

Commands:
  ${usage.discover}
  ${description.discover}

  ${usage.get}
  ${description.get}

  ${usage.put}
  ${description.put}

For more help, issue: ${b('ui')} ${u('command')} ${b('-h')}`,
  discover: `${description.discover}

Usage: ${b('ui')} ${usage.discover}

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
  Limit output to values. With ${b('-u')}, output a JSON array of values.`,
  get: `${description.get}

Usage: ${b('ui')} ${usage.get}

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
  
  ${u('resource')}
  The resource to get:
    ${b('/')}                             Get gateway.
    ${b('/accessories')}                  List accessories.
    ${b('/accessories/')}${u('id')}               Get accessory.
    ${b('/devices')}                      List devices.
    ${b('/devices/')}${u('id')}                   Get device.
    ${b('/gateways')}                     List gateways.
    ${b('/gateways/')}${u('gid')}                 Get gateway.
    ${b('/gateways/')}${u('gid')}${b('/accessories')}     List accessories.
    ${b('/gateways/')}${u('gid')}${b('/accessories/')}${u('id')}  Get accessory.
    ${b('/gateways/')}${u('gid')}${b('/devices')}         List devices.
    ${b('/gateways/')}${u('gid')}${b('/devices/')}${u('id')}      Get device.`,
  put: `${description.put}

Usage: ${b('ui')} ${usage.put}
  
Parameters:
  ${b('-h')}, ${b('--help')}
  Print this help and exit.

  ${u('resource')}
  The resource to update:
    ${b('/')}                             Update gateway settings.
    ${b('/accessories/')}${u('id')}               Update accessory settings.
    ${b('/devices/')}${u('id')}                   Update device settings.
    ${b('/gateways/')}${u('gid')}                 Update gateway settings.
    ${b('/gateways/')}${u('gid')}${b('/accessories/')}${u('id')}  Update accessory settings.
    ${b('/gateways/')}${u('gid')}${b('/devices/')}${u('id')}      Update device settings.

  ${u('body')}
  The new settings as JSON string.`
}

class Main extends CommandLineTool {
  constructor () {
    super({ mode: 'command', debug: false })
    this.usage = usage.deconz
  }

  parseArguments () {
    const parser = new CommandLineParser(packageJson)
    const clargs = {
      options: {
        timeout: 5
      }
    }
    parser
      .help('h', 'help', help.ui)
      .version('V', 'version')
      .flag('D', 'debug', () => {
        if (this.debugEnabled) {
          this.setOptions({ vdebug: true })
        } else {
          this.setOptions({ debug: true, chalk: true })
        }
      })
      .option('U', 'username', (value) => {
        clargs.username = OptionParser.toString(
          'username', value, true, true
        ).toUpperCase()
        if (!OptionParser.patterns.mac.test(clargs.username)) {
          throw new UsageError(`${clargs.username}: invalid username`)
        }
      })
      .option('G', 'gateway', (value) => {
        clargs.gateway = OptionParser.toString(
          'gateway', value, true, true
        ).toUpperCase()
      })
      .option('t', 'timeout', (value) => {
        clargs.options.timeout = OptionParser.toInt(
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

  /** Read and parse a JSON file.
    *
    * @param {string} filename - The name of the JSON file.
    * @returns {*} body - The contents of the JSON file as JavaScript object.
    */
  async readJsonFile (filename) {
    this.vdebug('reading %s', filename)
    const text = await fs.readFile(filename)
    this.debug('%s: %d bytes', filename, text.length)
    const body = JSON.parse(text)
    this.vdebug('%s: %j', filename, body)
    return body
  }

  /** Read Homebridge's cachedAccessories.
    *
    * @param {string} dir - The Homebridge user directory.
    * @param {string} username - The username (mac address) of the Homebridge bridge.
    * @param {string} platformName - The name of the platform.
    * @returns {Array<SerialisedAccessory>} accessories - The serialsed accessories.
    */
  async readCachedAccessories (dir, username, platformName) {
    let filename = dir + '/accessories/cachedAccessories'
    if (username != null) {
      filename += '.' + username.replace(/:/g, '').toUpperCase()
    }
    const body = await this.readJsonFile(filename)
    return body.filter((accessory) => {
      return accessory.platform === platformName
    })
  }

  /** Get platform entries from Homebridge's config.json file.
    *
    * @param {string} dir - The Homebridge user directory.
    * @param {string} platformName - The name of the platform.
    * @returns {Array<PlatformInfo>} platforms - Array of matching platforms.
    */
  async _getPlatforms (dir, platformName) {
    const filename = dir + '/config.json'
    const config = await this.readJsonFile(filename)
    const gateways = []
    for (const platform of config.platforms) {
      if (platform.platform !== platformName) {
        continue
      }
      try {
        const childBridge = platform._bridge != null
        const username = childBridge ? platform._bridge.username : config.bridge.username
        const cachedAccessories = await this.readCachedAccessories(
          dir, childBridge ? username : null, platformName
        )
        const cachedGateways = cachedAccessories.filter((accessory) => {
          return accessory.context.className === 'Gateway'
        })
        for (const gateway of cachedGateways) {
          gateways.push({
            platformName: platform.name == null ? platform.platform : platform.name,
            username,
            childBridge,
            uiPort: gateway.context.uiPort,
            gid: gateway.context.id,
            name: gateway.context.name
          })
        }
      } catch (error) { this.warn(error) }
    }
    return gateways
  }

  /** Get platform entries from Homebridge's config.json file.
    *
    * @param {string} platformName - The name of the platform.
    * @returns {Array<PlatformInfo>} platforms - Array of matching platforms.
    */
  async getPlatforms (platformName) {
    if (process.env.HOMEBRIDGE_DIR != null) {
      return this._getPlatforms(process.env.HOMEBRIDGE_DIR, platformName)
    }
    for (const dir of ['/var/lib/homebridge', process.env.HOME + '/.homebridge', '.']) {
      try {
        return await this._getPlatforms(dir, platformName)
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error
        }
      }
    }
    throw new Error('cannot find config.json - please set HOMEBRIDGE_DIR')
  }

  /** Create a client to the UI server.
    *
    * @param {integer} uiPort - The port for the UI server.
    * @returns {HttpClient} client - The UI client
    */
  async createUiClient (uiPort) {
    const host = 'localhost:' + uiPort
    const client = new HttpClient({
      host,
      json: true,
      name: host,
      timeout: this.clargs.options.timeout
    })
    client
      .on('error', (error) => {
        if (error.request.id !== this.requestId) {
          if (error.request.body == null) {
            this.log(
              '%s: request %d: %s %s', error.request.name, error.request.id,
              error.request.method, error.request.resource
            )
          } else {
            this.log(
              '%s: request %d: %s %s %s', error.request.name, error.request.id,
              error.request.method, error.request.resource, error.request.body
            )
          }
          this.requestId = error.request.id
        }
        this.error('%s: request %d: %s', error.request.name, error.request.id, error)
      })
      .on('request', (request) => {
        if (request.body == null) {
          this.debug(
            '%s: request %d: %s %s', request.name, request.id,
            request.method, request.resource
          )
          this.vdebug(
            '%s: request %d: %s %s', request.name, request.id,
            request.method, request.url
          )
        } else {
          this.debug(
            '%s: request %d: %s %s %s', request.name, request.id,
            request.method, request.resource, request.body
          )
          this.vdebug(
            '%s: request %d: %s %s %s', request.name, request.id,
            request.method, request.url, request.body
          )
        }
      })
      .on('response', (response) => {
        this.vdebug(
          '%s: request %d: response: %j', response.request.name, response.request.id,
          response.body
        )
        this.debug(
          '%s: request %d: %d %s', response.request.name, response.request.id,
          response.statusCode, response.statusMessage
        )
      })
    const response = await client.get('/ping')
    if (response.body !== 'pong') {
      throw new Error(`${host}: cannot ping`)
    }
    return client
  }

  async _main () {
    this.clargs = this.parseArguments()
    this.name = 'ui ' + this.clargs.command
    this.usage = `${b('ui')} ${usage[this.clargs.command]}`
    let platforms = await this.getPlatforms('deCONZ')
    if (platforms.length === 0) {
      throw new Error('no UI server found')
    }
    if (this.clargs.username != null) {
      platforms = platforms.filter((platform) => {
        return platform.username === this.clargs.username
      })
      if (platforms.length === 0) {
        throw new Error(`no UI server found for bridge ${this.clargs.username}`)
      }
    }
    if (this.clargs.gateway != null) {
      platforms = platforms.filter((platform) => {
        return platform.gid === this.clargs.gateway
      })
      if (platforms.length === 0) {
        throw new Error(`no UI server found for gateway ${this.clargs.gateway}`)
      }
    }
    if (this.clargs.command === 'discover') {
      return this.discover(platforms, this.clargs.args)
    }
    const { gid, uiPort } = platforms[0]
    this.client = await this.createUiClient(uiPort)
    this.gid = gid
    return this[this.clargs.command](this.clargs.args)
  }

  async discover (platforms, ...args) {
    const parser = new CommandLineParser(packageJson)
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
      .parse(...args)
    const jsonFormatter = new JsonFormatter(clargs.options)
    this.print(jsonFormatter.stringify(platforms))
  }

  async get (...args) {
    const parser = new CommandLineParser(packageJson)
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
      .parameter('resource', (value) => {
        clargs.resource = OptionParser.toPath('resource', value)
      })
      .parse(...args)
    if (clargs.resource === '/') {
      clargs.resource = '/gateways/' + this.gid
    } else if (
      clargs.resource.startsWith('/devices') ||
      clargs.resource.startsWith('/accessories')
    ) {
      clargs.resource = '/gateways/' + this.gid + clargs.resource
    }
    const { body } = await this.client.get(clargs.resource)
    const jsonFormatter = new JsonFormatter(clargs.options)
    this.print(jsonFormatter.stringify(body))
  }

  async put (...args) {
    const parser = new CommandLineParser(packageJson)
    const clargs = {
      options: {}
    }
    parser
      .help('h', 'help', help.put)
      .parameter('resource', (value) => {
        clargs.resource = OptionParser.toPath('resource', value)
      })
      .parameter('body', (value) => {
        value = OptionParser.toString('body', value, true, true)
        try {
          clargs.body = JSON.parse(value)
        } catch (error) {
          throw new UsageError(error.message) // Covert TypeError to UsageError.
        }
      })
      .parse(...args)
    if (clargs.resource === '/') {
      clargs.resource = '/gateways/' + this.gid
    } else if (
      clargs.resource.startsWith('/devices') ||
      clargs.resource.startsWith('/accessories')
    ) {
      clargs.resource = '/gateways/' + this.gid + clargs.resource
    }
    clargs.resource += '/settings'
    const jsonFormatter = new JsonFormatter(clargs.options)
    const { body } = await this.client.put(clargs.resource, clargs.body)
    this.print(jsonFormatter.stringify(body))
  }
}

new Main().main()
