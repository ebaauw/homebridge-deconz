// homebridge-deconz/lib/Deconz/ApiResponse.js
//
// Homebridge plug-in for deCONZ.
// Copyright © 2018-2022 Erik Baauw. All rights reserved.

'use strict'

const homebridgeLib = require('homebridge-lib')

const Deconz = require('./index')

/** Deconz API response.
  * @hideconstructor
  * @extends HttpClient.HttpResponse
  * @memberof Deconz
  */
class ApiResponse extends homebridgeLib.HttpClient.HttpResponse {
  constructor (response) {
    super(
      response.request, response.statusCode, response.statusMessage,
      response.headers, response.body, response.parsedBody
    )

    /** @member {object} - An object with the `"success"` API responses.
      */
    this.success = {}

    /** @member {Deconz.ApiError[]} - A list of `"error"` API responses.
      */
    this.errors = []

    if (Array.isArray(response.body)) {
      for (const id in response.body) {
        const e = response.body[id].error
        if (e != null && typeof e === 'object') {
          this.errors.push(new Deconz.ApiError(
            `api error ${e.type}: ${e.description}`,
            response, e.type, e.description
          ))
        }
        const s = response.body[id].success
        if (s != null && typeof s === 'object') {
          for (const path of Object.keys(s)) {
            const a = path.split('/')
            const key = a[a.length - 1]
            this.success[key] = s[path]
          }
        }
      }
    }
  }
}

module.exports = ApiResponse
