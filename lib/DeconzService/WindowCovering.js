// homebridge-deconz/lib/DeconzService/WindowCovering.js
// Copyright © 2022 Erik Baauw. All rights reserved.
//
// Homebridge plugin for deCONZ.

'use strict'

const homebridgeLib = require('homebridge-lib')
const DeconzService = require('../DeconzService')

const { timeout } = homebridgeLib

class WindowCovering extends DeconzService.LightsResource {
  constructor (accessory, resource, params = {}) {
    params.Service = accessory.Services.hap.WindowCovering
    super(accessory, resource, params)

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
      await this.setPosition()
    })

    this.addCharacteristicDelegate({
      key: 'positionState',
      Characteristic: this.Characteristics.hap.PositionState,
      value: this.Characteristics.hap.PositionState.STOPPED
    })

    this.addCharacteristicDelegate({
      key: 'holdPosition',
      Characteristic: this.Characteristics.hap.HoldPosition
    }).on('didSet', () => {
      this.put({ stop: true })
      this.values.positionState = this.Characteristics.hap.PositionState.STOPPED
    })

    if (this.venetianBlind) {
      this.addCharacteristicDelegate({
        key: 'closeUpwards',
        Characteristic: this.Characteristics.my.CloseUpwards
      }).on('didSet', async (value, fromHomeKit) => {
        if (!fromHomeKit) {
          return
        }
        await this.setPosition()
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
        await this.put({ speed: value })
      })
    }

    if (resource.capabilities.positionChange) {
      this.addCharacteristicDelegate({
        key: 'positionChange',
        Characteristic: this.Characteristics.my.PositionChange
      }).on('didSet', async (value) => {
        if (value !== 0) {
          this.put({ lift_inc: -value })
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
    if (this.venetianBlind) {
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
    await this.put({ lift })
  }

  updateState (state) {
    if (state.lift != null) {
      let position = Math.round(state.lift / 5) * 5
      let closeUpwards
      if (this.venetianBlind) {
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
