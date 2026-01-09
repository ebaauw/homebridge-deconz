#!/usr/bin/env node

// deconz.js
// Copyright © 2018-2026 Erik Baauw. All rights reserved.
//
// Command line interface to deCONZ gateway.

import { createRequire } from 'node:module'

import { DeconzTool } from 'hb-deconz-tools/DeconzTool'

const require = createRequire(import.meta.url)
const packageJson = require('../package.json')

new DeconzTool(packageJson).main()
