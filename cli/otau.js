#!/usr/bin/env node

// otau.js
// Copyright © 2023 Erik Baauw. All rights reserved.
//
// Command line interface to deCONZ gateway.

'use strict'

const { OtauTool } = require('hb-deconz-tools')
const pkgJson = require('../package.json')

new OtauTool(pkgJson).main()
