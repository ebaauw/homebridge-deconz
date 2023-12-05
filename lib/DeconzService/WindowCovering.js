// homebridge-deconz/lib/DeconzService/WindowCovering.js
// Copyright© 2022-2023 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const DeconzService = require('../DeconzService')
const { timeout } = require('homebridge-lib')

class WindowCovering extends DeconzService.LightsResource {
  constructor (accessory, resource, params = {}) {
    params.Service = accessory.Services.hap.WindowCovering
    super(accessory, resource, params)

    this.addCharacteristicDelegate({
      key: 'venetianBlind',
      value: false,
      silent: true
    })

    this.addCharacteristicDelegate({
      key: 'currentPosition',
      Characteristic: this.Characteristics.hap.CurrentPosition,
      unit: '%'
    })

    this.addCharacteristicDelegate({
      key: 'targetPosition',
      Characteristic: this.Characteristics.hap.TargetPosition,
      unit: '%'
    }).on('didSet', async (value, fromHomeKit) => {
      if (!fromHomeKit) {
        return
      }
      this.values.targetPosition = Math.round(this.values.targetPosition / 5) * 5
      return this.setPosition()
    })

    this.addCharacteristicDelegate({
      key: 'positionState',
      Characteristic: this.Characteristics.hap.PositionState,
      value: this.Characteristics.hap.PositionState.STOPPED
    })

    this.addCharacteristicDelegate({
      key: 'holdPosition',
      Characteristic: this.Characteristics.hap.HoldPosition
    }).on('didSet', async () => {
      await this.put(this.statePath, { stop: true })
      this.values.positionState = this.Characteristics.hap.PositionState.STOPPED
    })

    if (this.values.venetianBlind) {
      this.addCharacteristicDelegate({
        key: 'closeUpwards',
        Characteristic: this.Characteristics.my.CloseUpwards
      }).on('didSet', async (value, fromHomeKit) => {
        if (!fromHomeKit) {
          return
        }
        if (this.values.currentPosition !== 100) {
          return this.setPosition()
        }
      })
    }

    if (resource.capabilities.maxSpeed != null) {
      this.addCharacteristicDelegate({
        key: 'motorSpeed',
        Characteristic: this.Characteristics.my.MotorSpeed,
        unit: '',
        props: {
          unit: '',
          minValue: 0,
          maxValue: resource.capabilities.maxSpeed,
          minStep: 1
        }
      }).on('didSet', async (value, fromHomeKit) => {
        if (!fromHomeKit) {
          return
        }
        await this.put('/config', { speed: value })
      })
    }

    if (resource.capabilities.positionChange) {
      this.addCharacteristicDelegate({
        key: 'positionChange',
        Characteristic: this.Characteristics.my.PositionChange
      }).on('didSet', async (value) => {
        if (value !== 0) {
          await this.put(this.statePath, { lift_inc: -value })
          await timeout(this.platform.config.waitTimeReset)
          this.values.positionChange = 0
        }
      })
      this.values.positionChange = 0
    }

    this.addCharacteristicDelegates()

    this.update(resource.body, resource.rpath)
    this.values.targetPosition = this.values.currentPosition
  }

  async setPosition () {
    let lift = 100 - this.values.targetPosition // % closed --> % open
    if (this.values.venetianBlind) {
      if (this.values.closeUpwards) {
        lift *= -1
      }
      lift += 100
      lift /= 2
      lift = Math.round(lift)
      this.targetCloseUpwards = this.values.closeUpwards
    }
    this.values.positionState =
      this.values.targetPosition > this.values.currentPosition
        ? this.Characteristics.hap.PositionState.INCREASING
        : this.Characteristics.hap.PositionState.DECREASING
    this.moving = new Date()
    if (lift === 0 || lift === 100) {
      return this.put(this.statePath, { open: lift === 0 })
    }
    return this.put(this.statePath, { lift })
  }

  updateState (state) {
    if (state.lift != null) {
      let position = Math.round(state.lift / 5) * 5
      let closeUpwards
      if (this.values.venetianBlind) {
        position *= 2
        position -= 100
        if (position < 0) {
          position *= -1
          closeUpwards = true
        } else if (position > 0) {
          closeUpwards = false
        }
      }
      position = 100 - position // % open -> % closed
      this.values.currentPosition = position
      if (closeUpwards != null) {
        this.values.closeUpwards = closeUpwards
      }
      if (
        this.moving == null || new Date() - this.moving >= 30000 || (
          position === this.values.targetPosition &&
          (closeUpwards == null || closeUpwards === this.targetCloseUpwards)
        )
      ) {
        this.moving = null
        this.values.targetPosition = position
        this.values.positionState = this.Characteristics.hap.PositionState.STOPPED
      }
    }
    if (state.speed != null) {
      this.values.motorSpeed = state.speed
    }
    super.updateState(state)
  }
}

module.exports = WindowCovering
