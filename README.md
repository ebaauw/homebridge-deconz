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
Copyright © 2022-2024 Erik Baauw. All rights reserved.

### Introduction
This [Homebridge](https://github.com/homebridge/homebridge) plugin exposes to Apple's [HomeKit](http://www.apple.com/ios/home/) ZigBee devices (lights, plugs, sensors, switches, ...) and virtual devices on a deCONZ gateway by dresden elektronik.
Homebridge deCONZ communicates with deCONZ over its [REST API](https://dresden-elektronik.github.io/deconz-rest-doc/), provided by its [REST API plugin](https://github.com/dresden-elektronik/deconz-rest-plugin).
It runs independently from the Phoscon web app, see [deCONZ for Dummies](https://github.com/dresden-elektronik/deconz-rest-plugin/wiki/deCONZ-for-Dummies).

Homebridge deCONZ is the successor of Homebridge Hue for exposing Zigbee devices connected to a deCONZ gateway.
See [Future Development of Homebridge Hue](https://github.com/ebaauw/homebridge-hue/issues/1070) for more details.

### Prerequisites
You need a deCONZ gateway to connect Homebridge deCONZ to your ZigBee devices (lights, plugs, sensors, switches, ...).
For Zigbee communication, the deCONZ gateway requires a [ConBee II](https://phoscon.de/en/conbee2) or [Conbee](https://phoscon.de/en/conbee) USB stick, or a [RaspBee II](https://phoscon.de/en/raspbee2) or [RaspBee](https://phoscon.de/en/raspbee) Raspberry Pi shield.  
I recommend to run deCONZ with its GUI enabled, even on a headless system.
When needed, you can access the deCONZ GUI over screen sharing.

You need a server to run Homebridge.
This can be anything running [Node.js](https://nodejs.org): from a Raspberry Pi, a NAS system, or an always-on PC running Linux, macOS, or Windows.  
I strongly recommend to use a standard Homebridge installation, see the [Homebridge Wiki](https://github.com/homebridge/homebridge/wiki) for details.
I recommend to run deCONZ and Homebridge deCONZ on the same server, avoiding any network latency between deCONZ and Homebridge deCONZ, and preventing any potential network issues.
I strongly recommend to run Homebridge deCONZ in a separate [child bridge](https://github.com/homebridge/homebridge/wiki/Child-Bridges).

To interact with HomeKit, you need an Apple device with Siri or a HomeKit app.  
Please note that Siri and Apple's [Home](https://support.apple.com/en-us/HT204893) app only provide limited HomeKit support.
To use the full features of Homebridge deCONZ, you need another HomeKit app, like [Eve](https://www.evehome.com/en/eve-app) (free) or Matthias Hochgatterer's [Home+](https://hochgatterer.me/home/) (paid).  
As HomeKit uses mDNS (formally known as Bonjour) to discover Homebridge, the server running Homebridge must be on the same subnet as your Apple devices running HomeKit.
Most cases of _Not Responding_ accessories are due to mDNS issues.  
For remote access and for HomeKit automations (incl. support for wireless switches), you need to setup an Apple TV (4th generation or later), HomePod, or iPad as [home hub](https://support.apple.com/en-us/HT207057).  
I recommend to use the latest released non-beta version of the Apple device OS: iOS, iPadOS, macOS, ...
HomeKit doesn't seem to like using different Apple device OS versions.

### Configuration
Most settings for Homebridge deCONZ, can be changed at run-time, including which devices to expose, how to expose these, and the level of logging.
This keeps `config.json` extremely simple.
Typically, you only need to specify the hostname and port of the deCONZ gateway(s) in `config.json`.
See [`Configuration`](https://github.com/ebaauw/homebridge-deconz/wiki/Configuration) in the Wiki for details.
I strongly recommended to run Homebridge deCONZ in a separate [child bridge](https://github.com/homebridge/homebridge/wiki/Child-Bridges).

Homebridge deCONZ provides a Configuration API to change the run-time settings.
These changes take effect immediately, and are persisted across Homebridge restarts.
See [`Dynamic Configuration`](https://github.com/ebaauw/homebridge-deconz/wiki/Dynamic-Configuration) in the Wiki for details.
For now, these dynamic settings are managed through the `ui` command-line tool.
Eventually, Homebridge deCONZ might provide a configuration user interface to the Homebridge UI, using this configuration API.

When it connects to a deCONZ gateway for the first time, Homebridge deCONZ will try to obtain an API key for two minutes, before exposing the gateway accessory.
Unless Homebridge deCONZ runs on the same server as the deCONZ gateway, you need to unlock the gateway to allow Homebridge deCONZ to obtain an API key.
If you don't, Homebridge deCONZ will give up, after two minutes.
In this case, you need to set `expose` on the gateway dynamic settings, to retry obtaining an API key.
Homebridge deCONZ will **not** retry to obtain an API key on Homebridge restart.

Once it has obtained an API key, Homebridge deCONZ will expose all Zigbee devices connected to the gateway, by default. 
Use the dynamic settings to exclude devices from being exposed, to change how devices are exposed, and to expose virtual devices like groups or CLIP sensors.  
Homebridge deCONZ exposes a [gateway accessory](https://github.com/ebaauw/homebridge-deconz/wiki/Gateway-Accessory) for each deCONZ gateway.
In Apple's Home app, this accessory looks like a wireless switch; you'll need another HomeKit app to use the other features of this accessory.

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
Please check the [FAQ](https://github.com/ebaauw/homebridge-hue/wiki/FAQ) (for now still on Homebridge Hue Wiki).

#### Check Dependencies
If you run into Homebridge startup issues, please double-check what versions of Node.js and of Homebridge have been installed.
Homebridge deCONZ has been developed and tested using the [latest LTS](https://nodejs.org/en/about/releases/) version of Node.js and the [latest](https://www.npmjs.com/package/homebridge) version of Homebridge.
Other versions might or might not work - I simply don't have the bandwidth to test these.

#### Run Homebridge deCONZ Solo
If you run into Homebridge startup issues, please run Homebridge deCONZ in a separate [child bridge](https://github.com/homebridge/homebridge/wiki/Child-Bridges).

#### Debug Log File
Homebridge deCONZ outputs an info message to the Homebridge log, for each HomeKit characteristic value it sets and for each HomeKit characteristic value change notification it receives.  Make sure that `logLevel` of the corresponding accessory is at least 1, to see these info messages.

Homebridge deCONZ outpits a debug message to the Homebridge log, for each interaction with a deCONZ gateway.
Make sure to run Homebridge in DEBUG mode, and that `logLevel` of the corresponding accessory is at least 2, to see these debug messages.  Set `logLevel` to 3 to log the payload of the interaction with deCONZ as well.

#### Debug Dump File
To aid troubleshooting, on startup, Homebridge deCONZ dumps its environment, including its `config.json` settings, dynamic settings, and the full state of all gateways into a compresed json file, `homebridge-deconz.json.gz`.
This file is located in the Homebridge user directory.

#### Getting help
If you have a question about Homebridge deCONZ, please post a message to the **#deconz** channel of the Homebridge community on [Discord](https://discord.gg/zUhSZSNb4P).

If you encounter a problem with Homebridge deCONZ, please open an issue on [GitHub](https://github.com/ebaauw/homebridge-deconz/issues).
Please attach a copy of `homebridge-deconz.json.gz` to the issue, see [**Debug Dump File**](#debug-dump-file).
Please attach a copy of the (compressed) Homebridge log file to the issue, see [**Debug Log File**](#debug-log-file).
Please do **not** copy/paste large amounts of log output.

### Contributing
Sometimes I get the question how people can support my work on Homebridge deCONZ.
I created Homebridge deCONZ as a hobby project, for my own use.
I share it on GitHub so others might benefit, and to give back to the open source community, without whom Homebridge Hue wouldn't have been possible.

Having said that, adding support for new devices, in Homebridge deCONZ, and in the deCONZ REST API plugin, is very hard without having physical access to the device.
Since this is a hobby project, I cannot afford to spend money on devices I won't be using myself, just to integrate them for the benefit of others.
I am happy to receive small donations in the form of new devices to integrate, or the money to buy these devices myself.
I am also happy to return the devices afterwards, if you provide the shipping costs.
Please contact me by email or on Discord for shipping details.

### Caveats
Homebridge deCONZ is a hobby project of mine, provided as-is, with no warranty whatsoever.  I've been running it successfully at my home since May 2023, replacing Homebridge Hue, but your mileage might vary.
