#!/usr/bin/env node

// otau.js
// Copyright © 2023-2026 Erik Baauw. All rights reserved.
//
// Command line interface to deCONZ gateway.

import { createRequire } from 'node:module'

import { OtauTool } from 'hb-deconz-tools/OtauTool'

const require = createRequire(import.meta.url)
const packageJson = require('../package.json')

new OtauTool(packageJson).main()
