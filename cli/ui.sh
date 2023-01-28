#!/usr/bin/env bash

# homebridge-deconz/cli/ui.sh
# Copyright © 2023 Erik Baauw. All rights reserved.
#
# Command line interface to Homebridge deCONZ UI Server.

me=$(basename "$0")

function fatal() {
    echo "${me}: $1" >&2
    exit 1
}

if [ -z "${HOMEBRIDGE_DIR}" ] ; then
    if [ -d /var/lib/homebridge ] ; then
        HOMEBRIDGE_DIR=/var/lib/homebridge
    elif [ -d ~/.homebridge ] ; then
        HOMEBRIDGE_DIR=~/.homebridge
    else
        fatal "cannot find Homebridge directory - set HOMEBRIDGE_DIR"
    fi
fi

if [ ! -f "${HOMEBRIDGE_DIR}/config.json" ] ; then
    fatal "${HOMEBRIDGE_DIR|}/config.json: no such file"
fi

platformId=$(json -alp /platforms "${HOMEBRIDGE_DIR}/config.json" | grep /platform:\"deCONZ\" | cut -d / -f 2)
if [ -z "${platformId}" ] ; then
    fatal "${HOMEBRIDGE_DIR}/config.json: cannot find deCONZ platform"
fi

username=$(json -alp /platforms/${platformId}/_bridge "${HOMEBRIDGE_DIR}/config.json" | grep /username: | cut -d \" -f 2 | sed -e "s/://g")
if [ -z "${username}" ] ; then
    # Main Homebridge instance
    cachedAccessories="${HOMEBRIDGE_DIR}/accessories/cachedAccessories"
else
    # Child bridge instance
    cachedAccessories="${HOMEBRIDGE_DIR}/accessories/cachedAccessories.${username}"
fi
if [ ! -f "${cachedAccessories}" ] ; then
    fatal "${cachedAccessories}: no such file"
    exit 1
fi

uiPort=$(json -alp /${platformId}/context "${cachedAccessories}" | grep /uiPort: | cut -d : -f 2)
gateway=$(json -alp /${platformId}/context "${cachedAccessories}" | grep /gid: | cut -d \" -f 2)

url="http://127.0.0.1:${uiPort}"

if [ "$(curl -s ${url}/ping)" != '"pong"' ] ; then
   fatal "${url}: cannot connect to UI server"
fi

if [ -z "${1}" ] ; then
    cat - >&2 <<+
Usage: ${me} command [arguments]

Commands:
  get                       Get gateway details.
  put body                  Update gateway settings.
  getDevices                Get list of devices.
  getDevice id              Get device details.
  putDevice id body         Update device settings.
  getAccessories            Get list of accessories
  getAccessory id           Get accessory details
  putAccessory id body      Update accessory settings.
+
    exit 1
fi

case "$1" in
    get)            curl -s ${url}/gateways/${gateway} | json ;;
    put)            curl -s -X PUT -d "${2}" ${url}/gateways/${gateway}/settings | json ;;
    getDevices)     curl -s ${url}/gateways/${gateway}/devices | json ;;
    getDevice)      curl -s ${url}/gateways/${gateway}/devices/${1} | json ;;
    putDevice)      curl -s -X PUT -d "${2}" ${url}/gateways/${gateway}/devices/${1}/settings | json ;;
    getAccessories) curl -s ${url}/gateways/${gateway}/accessories | json ;;
    getAccessory)   curl -s ${url}/gateways/${gateway}/accessories/${1} | json ;;
    putAccessory)   curl -s -X PUT -d "${2}" ${url}/gateways/${gateway}/accessories/${1}/settings | json ;;
    *)              fatal "${1}: invalid command" ;;
esac
