<p align="center">
  <img src="homebridge-deconz.png" height="200px">  
</p><span align="center">

# Homebridge deCONZ
[![Downloads](https://img.shields.io/npm/dt/homebridge-deconz)](https://www.npmjs.com/package/homebridge-deconz)
[![Version](https://img.shields.io/npm/v/homebridge-deconz)](https://www.npmjs.com/package/homebridge-deconz)
[![Homebridge Discord](https://img.shields.io/discord/432663330281226270?color=728ED5&logo=discord&label=discord)](https://discord.gg/hZubhrz)

[![GitHub issues](https://img.shields.io/github/issues/ebaauw/homebridge-deconz)](https://github.com/ebaauw/homebridge-deconz/issues)
[![GitHub pull requests](https://img.shields.io/github/issues-pr/ebaauw/homebridge-deconz)](https://github.com/ebaauw/homebridge-deconz/pulls)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen)](https://standardjs.com)

</span>

## Homebridge plugin for deCONZ
Copyright © 2022 Erik Baauw. All rights reserved.

### Work in Progress
See [Future Development of Homebridge Hue](https://github.com/ebaauw/homebridge-hue/issues/1070) for positioning Homebridge deCONZ versus Homebridge Hue.

The current pre-release of Homebridge deCONZ is not yet functional.
I'm using it to stress-test the technical framework.
See [Releases](https://github.com/ebaauw/homebridge-deconz/releases) for more details.

If you have a question, please post a message to the **#hue** channel of the Homebridge community on [Discord](https://discord.gg/hZubhrz).

### Introduction
This [Homebridge](https://github.com/homebridge/homebridge) plugin exposes to Apple's [HomeKit](http://www.apple.com/ios/home/) ZigBee devices (lights, plugs, sensors, switches, ...) and virtual devices on a [deCONZ](https://github.com/dresden-elektronik/deconz-rest-plugin) gateway by dresden elektronik.

For a better understanding of deCONZ, see [deCONZ for Dummies](https://github.com/dresden-elektronik/deconz-rest-plugin/wiki/deCONZ-for-Dummies).

### Configuration
Most settings for Homebridge deCONZ can be changed at run-time from HomeKit.
These settings are persisted across Homebridge restarts.
In config.json, you only need to specify the platform, and maybe the hostname or IP address and port of your deCONZ gateway(s).
See the [Wiki](https://github.com/ebaauw/homebridge-deconz/wiki/Configuration) for details and examples.

Unless Homebridge deCONZ runs on the same server as the deCONZ gateway, you need to unlock the gateway to obtain an API key.
Homebridge deCONZ will wait for two minutes on the first startup, delaying the startup of Homebridge.
After that, Homebridge deCONZ will give up, allowing Homebridge to start.
To retry, you need to set _Expose_ on the _Gateway Settings_ service of the Gateway accessory.
Homebridge deCONZ will **not** retry on Homebridge restart.

After obtaining the API key, the Gateway accessory gains three _Device Settings_ services, to expose _Groups_, _Lights_, and _Sensors_.
When setting the _Expose_ characteristic on one of these services to _On_, accessories for the corresponding devices (!) appear in HomeKit, and the Gateway accessory gains an additional _Device Settings_ service per device, to blacklist or re-expose the device.
Note that, unlike Homebridge Hue, Homebridge deCONZ handles white- and blacklisting per device, instead of per resource.
Exposing _Lights_ will include the ZHAConsumption and ZHAPower `/sensors` resources for smart plugs, and the ZHABattery for window covering devices, and exposing only _Sensors_ will exclude these.

Note that all devices (except the gateway) are currently exposed with only a dummy switch service.
