// homebridge-deconz/lib/Deconz/ApiError.js
//
// Homebridge plug-in for deCONZ.
// Copyright © 2018-2022 Erik Baauw. All rights reserved.

'use strict'

const homebridgeLib = require('homebridge-lib')

// API errors that could still cause (part of) the PUT command to be executed.
const nonCriticalApiErrorTypes = [
  6, // parameter not available
  7, // invalid value for parameter
  8, // paramater not modifiable
  201 // paramater not modifiable, device is set to off
]

/** Deconz API error.
  * @hideconstructor
  * @extends HttpClient.HttpError
  * @memberof Deconz
  */
class ApiError extends homebridgeLib.HttpClient.HttpError {
  constructor (message, response, type, description) {
    super(message, response.request, response.statusCode, response.statusMessage)

    /** @member {integer} - The API error type.
      */
    this.type = type

    /** @member {string} - The API error description.
      */
    this.description = description

    /** @member {boolean} - Indication that the request might still succeed
      * for other attributes.
      */
    this.nonCritical = nonCriticalApiErrorTypes.includes(type)
  }
}

module.exports = ApiError
