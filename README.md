<p align="center">
  <img src="homebridge-ui/public/homebridge-deconz.png" height="200px">  
</p>
<span align="center">

# Homebridge deCONZ
[![Downloads](https://img.shields.io/npm/dt/homebridge-deconz)](https://www.npmjs.com/package/homebridge-deconz)
[![Version](https://img.shields.io/npm/v/homebridge-deconz)](https://www.npmjs.com/package/homebridge-deconz)
[![Homebridge Discord](https://img.shields.io/discord/432663330281226270?color=728ED5&logo=discord&label=discord)](https://discord.gg/zUhSZSNb4P)
[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)

[![GitHub issues](https://img.shields.io/github/issues/ebaauw/homebridge-deconz)](https://github.com/ebaauw/homebridge-deconz/issues)
[![GitHub pull requests](https://img.shields.io/github/issues-pr/ebaauw/homebridge-deconz)](https://github.com/ebaauw/homebridge-deconz/pulls)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen)](https://standardjs.com)

</span>

## Homebridge plugin for deCONZ
Copyright© 2022-2023 Erik Baauw. All rights reserved.

### Work in Progress
See [Future Development of Homebridge Hue](https://github.com/ebaauw/homebridge-hue/issues/1070) for positioning Homebridge deCONZ versus Homebridge Hue.

Homebridge deCONZ is still under development.
See [Releases](https://github.com/ebaauw/homebridge-deconz/releases) for more details.

If you have a question, please post a message to the **#deconz** channel of the Homebridge community on [Discord](https://discord.gg/zUhSZSNb4P).

### Introduction
This [Homebridge](https://github.com/homebridge/homebridge) plugin exposes to Apple's [HomeKit](http://www.apple.com/ios/home/) ZigBee devices (lights, plugs, sensors, switches, ...) and virtual devices on a deCONZ gateway by dresden elektronik.
Homebridge deCONZ communicates with deCONZ over its [REST API](https://dresden-elektronik.github.io/deconz-rest-doc/), provided by its [REST API plugin](https://github.com/dresden-elektronik/deconz-rest-plugin).
It runs independently from the Phoscon web app, see [deCONZ for Dummies](https://github.com/dresden-elektronik/deconz-rest-plugin/wiki/deCONZ-for-Dummies).

### Prerequisites
You need a deCONZ gateway to connect Homebridge deCONZ to your ZigBee devices (lights, plugs, sensors, switches, ...).
For Zigbee communication, the deCONZ gateway requires a [ConBee II](https://phoscon.de/en/conbee2) or [Conbee](https://phoscon.de/en/conbee) USB stick, or a [RaspBee II](https://phoscon.de/en/raspbee2) or [RaspBee](https://phoscon.de/en/raspbee) Raspberry Pi shield.  
I recommend to run deCONZ with its GUI enabled, even on a headless system.
When needed, you can access the deCONZ GUI over screen sharing.

You need a server to run Homebridge.
This can be anything running [Node.js](https://nodejs.org): from a Raspberry Pi, a NAS system, or an always-on PC running Linux, macOS, or Windows.  
I strongly recommend to use a standard Homebridge installation, see the [Homebridge Wiki](https://github.com/homebridge/homebridge/wiki) for details.
I recommend to run deCONZ and Homebridge deCONZ on the same server, avoiding any network latency between deCONZ and Homebridge deCONZ, and preventing any potential network issues.
I strongly recommend to run Homebridge deCONZ in a separate Homebridge installation, with the Homebridge UI as only other plugin, or in a separate [child bridge](https://github.com/homebridge/homebridge/wiki/Child-Bridges), in a Homebridge installation with other plugins.

To interact with HomeKit, you need an Apple device with Siri or a HomeKit app.  
Please note that Siri and Apple's [Home](https://support.apple.com/en-us/HT204893) app only provide limited HomeKit support.
To use the full features of Homebridge deCONZ, you need another HomeKit app, like [Eve](https://www.evehome.com/en/eve-app) (free) or Matthias Hochgatterer's [Home+](https://hochgatterer.me/home/) (paid).  
As HomeKit uses mDNS (formally known as Bonjour) to discover Homebridge, the server running Homebridge must be on the same subnet as your Apple devices running HomeKit.
Most cases of _Not Responding_ accessories are due to mDNS issues.  
For remote access and for HomeKit automations (incl. support for wireless switches), you need to setup an Apple TV (4th generation or later), HomePod, or iPad as [home hub](https://support.apple.com/en-us/HT207057).  
I recommend to use the latest released version of the Apple device OS: iOS, iPadOS, macOS, ...
HomeKit doesn't seem to like using different Apple device OS versions.

### Configuration
Most settings for Homebridge deCONZ, can be changed at run-time, including which devices to expose, how to expose these, and the level of logging.
This keeps `config.json` extremely simple.
Typically, you only need to specify the hostname and port of the deCONZ gateway(s) in `config.json`.
See [`Configuration`](https://github.com/ebaauw/homebridge-deconz/wiki/Configuration) in the Wiki for details.

Homebridge deCONZ provides a Configuration API to change the run-time settings.
These changes take effect immediately, and are persisted across Homebridge restarts.
See [`Dynamic Configuration`](https://github.com/ebaauw/homebridge-deconz/wiki/Dynamic-Configuration) in the Wiki for details.
For now, these dynamic settings are managed through the `ui` command-line tool.
Eventually, Homebridge deCONZ might provide a configuration user interface to the Homebridge UI, using the configuration API.

When it connects to a deCONZ gateway for the first time, Homebridge deCONZ will try to obtain an API key for two minutes, before exposing the gateway accessory.
Unless Homebridge deCONZ runs on the same server as the deCONZ gateway, you need to unlock the gateway to allow Homebridge deCONZ to obtain an API key.
After two minutes, Homebridge deCONZ will give up.
You need to set `expose` on the gateway dynamic settings, to retry obtaining an API key.
Homebridge deCONZ will **not** retry to obtain an API key on Homebridge restart.

Once it has obtained an API key, by default, Homebridge deCONZ will expose all Zigbee devices connected to the gateway, 
Use the dynamic settings to prevent devices from being exposed, to change how devices are exposed, and to expose virtual devices like groups or CLIP sensors.  
Homebridge deCONZ exposes a [gateway accessory](https://github.com/ebaauw/homebridge-deconz/wiki/Gateway-Accessory) for each deCONZ gateway.
In Apple's Home app, this accessory looks like a wireless switch; you'll need another HomeKit app to use the accessory.

Note that HomeKit doesn't like configuration changes.
After adding or removing accessories, allow ample time for HomeKit to sync the changed configuration to all Apple devices.

### Command-Line Utilities
Homebridge deCONZ includes the following command-line utilities:
- `deconz`, to discover, monitor, and interact with deCONZ gateways.  
See the [`deconz` Command-Line Utility](https://github.com/ebaauw/homebridge-deconz/wiki/deconz-Command%E2%80%90Line-Utility) in the Wiki for more info.
- `otau`, to download and analyse over-the-air-update firmware files for Zigbee devices.
- `ui` to configure a running instance of Homebridge deCONZ.  
See [`Dynamic Configuration`](https://github.com/ebaauw/homebridge-deconz/wiki/Dynamic-Configuration) in the Wiki for more info.

Each command-line tool takes a `-h` or `--help` argument to provide a brief overview of its functionality and command-line arguments.

### Troubleshooting
- As mentioned above, Homebridge deCONZ is still under development.  Sometimes, cached accessories from an older version might confuse a newer version, causing all sorts of weird errors.  In this case, best un-expose the offending accessory, wait for HomeKit to remove it, and re-expose the accessory.  Note that this will cause HomeKit to see a new accessory, and lose any associations with HomeKit rooms, groups, scenes, and automations.
