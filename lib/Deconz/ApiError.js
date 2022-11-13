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
  constructor (e, response) {
    super(
      `${e.address}: api error ${e.type}: ${e.description}`,
      response.request, response.statusCode, response.statusMessage
    )

    /** @member {integer} - The API error type.
      */
    this.type = e.type

    /** @member {string} - The address causing the error.
      */
    this.address = e.address

    /** @member {string} - The API error description.
      */
    this.description = e.description

    /** @member {boolean} - Indication that the request might still succeed
      * for other attributes.
      */
    this.nonCritical = nonCriticalApiErrorTypes.includes(e.type)
  }
}

module.exports = ApiError
