/* jshint -W014, -W033, esversion: 9 */
/* eslint-disable new-cap */
'use strict'

module.exports = class deviceGarageTwo {
  constructor (platform, accessory) {
    // Set up variables from the platform
    this.consts = platform.consts
    this.debug = platform.config.debug
    this.funcs = platform.funcs
    this.hapServ = platform.api.hap.Service
    this.hapChar = platform.api.hap.Characteristic
    this.log = platform.log
    this.lang = platform.lang
    this.platform = platform

    // Set up variables from the accessory
    this.name = accessory.displayName
    this.accessory = accessory

    // Set up custom variables for this device type
    const deviceId = this.accessory.context.eweDeviceId
    const deviceConf = platform.simulations[deviceId]
    this.operationTimeUp = deviceConf.operationTime ||
      this.consts.defaultValues.operationTime
    this.operationTimeDown = deviceConf.operationTimeDown || this.operationTimeUp
    this.disableDeviceLogging = deviceConf.overrideDisabledLogging
      ? false
      : platform.config.disableDeviceLogging

    // Set up the accessory with default positions when added the first time
    if (!this.funcs.hasProperty(this.accessory.context, 'cacheCurrentDoorState')) {
      this.accessory.context.cacheOneCurrentDoorState = 1
      this.accessory.context.cacheOneTargetDoorState = 1
      this.accessory.context.cacheTwoCurrentDoorState = 1
      this.accessory.context.cacheTwoTargetDoorState = 1
    }

    // We want two garage door services for this accessory
    ;['1', '2'].forEach(v => {
      // Add the garage door service if it doesn't already exist
      let gdService
      if (!(gdService = this.accessory.getService('Garage ' + v))) {
        gdService = this.accessory.addService(
          this.hapServ.GarageDoorOpener,
          'Garage ' + v,
          'garage' + v
        )
        gdService.setCharacteristic(this.hapChar.CurrentDoorState, 1)
        gdService.setCharacteristic(this.hapChar.TargetDoorState, 1)
        gdService.setCharacteristic(this.hapChar.ObstructionDetected, false)
      }

      // Add the set handler to the target position characteristic
      gdService.getCharacteristic(this.hapChar.TargetDoorState).onSet(value => {
        // We don't use await as we want the callback to be run straight away
        this.internalUpdate('Garage' + v, value)
      })
    })

    // Output the customised options to the log if in debug mode
    if (this.debug) {
      const opts = JSON.stringify({
        disableDeviceLogging: this.disableDeviceLogging,
        operationTimeDown: this.operationTimeDown,
        operationTimeUp: this.operationTimeUp,
        type: deviceConf.type
      })
      this.log('[%s] %s %s.', this.name, this.lang.devInitOpts, opts)
    }
  }

  async internalUpdate (garage, value) {
    try {
      const newPos = value
      const params = {
        switches: []
      }
      const gdService = this.accessory.getService(garage)
      const prevState = garage === 'Garage 1'
        ? this.accessory.context.cacheOneCurrentDoorState
        : this.accessory.context.cacheTwoCurrentDoorState
      if (newPos === prevState % 2) {
        return
      }
      this.inUse = true
      gdService.updateCharacteristic(this.hapChar.TargetDoorState, newPos)
      gdService.updateCharacteristic(this.hapChar.CurrentDoorState, newPos + 2)
      switch (garage) {
        case 'Garage 1': {
          this.accessory.context.cacheOneTargetDoorState = newPos
          this.accessory.context.cacheOneCurrentDoorState = newPos + 2
          params.switches.push({ switch: newPos === 0 ? 'on' : 'off', outlet: 0 })
          params.switches.push({ switch: newPos === 1 ? 'on' : 'off', outlet: 1 })
          break
        }
        case 'Garage 2': {
          this.accessory.context.cacheTwoTargetDoorState = newPos
          this.accessory.context.cacheTwoCurrentDoorState = newPos + 2
          params.switches.push({ switch: newPos === 0 ? 'on' : 'off', outlet: 2 })
          params.switches.push({ switch: newPos === 1 ? 'on' : 'off', outlet: 3 })
          break
        }
      }
      await this.platform.sendDeviceUpdate(this.accessory, params)
      await this.funcs.sleep(2000)
      this.inUse = false
      const operationTime = newPos === 0
        ? this.operationTimeUp
        : this.operationTimeDown
      await this.funcs.sleep(Math.max((operationTime - 20) * 100, 0))
      gdService.updateCharacteristic(this.hapChar.CurrentDoorState, newPos)
      switch (garage) {
        case 'Garage 1': {
          this.accessory.context.cacheOneCurrentDoorState = newPos
          if (!this.disableDeviceLogging) {
            this.log(
              '[%s] %s [garage 1 %s].',
              this.name,
              this.lang.curState,
              newPos === 0 ? this.lang.doorOpen : this.lang.doorClosed
            )
          }
          break
        }
        case 'Garage 2': {
          this.accessory.context.cacheTwoCurrentDoorState = newPos
          if (!this.disableDeviceLogging) {
            this.log(
              '[%s] %s [garage 2 %s].',
              this.name,
              this.lang.curState,
              newPos === 0 ? this.lang.doorOpen : this.lang.doorClosed
            )
          }
          break
        }
      }
    } catch (err) {
      this.inUse = false
      this.platform.deviceUpdateError(this.accessory, err, true)
      const gdService = this.accessory.getService(garage)
      setTimeout(() => {
        gdService.updateCharacteristic(
          this.hapChar.TargetPosition,
          this.accessory.context.cacheTargetPosition
        )
      }, 5000)
      gdService.updateCharacteristic(
        this.hapChar.TargetPosition,
        new this.platform.api.hap.HapStatusError(-70402)
      )
    }
  }

  externalUpdate (params) {
    try {
      if (!params.switches || this.inUse) {
        return
      }
      ;['1', '2'].forEach(async v => {
        const gcService = this.accessory.getService('Garage ' + v)
        const prevState = v === '1'
          ? this.accessory.context.cacheOneCurrentDoorState
          : this.accessory.context.cacheTwoCurrentDoorState
        const newPos = [0, 2].includes(prevState) ? 3 : 2
        switch (v) {
          case '1':
            if (
              params.switches[0].switch === params.switches[1].switch ||
              params.switches[prevState % 2].switch === 'on'
            ) {
              return
            }
            break
          case '2':
            if (
              params.switches[2].switch === params.switches[3].switch ||
              params.switches[(prevState % 2) + 2].switch === 'on'
            ) {
              return
            }
            break
        }
        this.inUse = true
        gcService.updateCharacteristic(this.hapChar.TargetDoorState, newPos - 2)
        gcService.updateCharacteristic(this.hapChar.CurrentDoorState, newPos)
        switch (v) {
          case '1':
            this.accessory.context.cacheOneCurrentDoorState = newPos
            this.accessory.context.cacheTwoTargetDoorState = newPos - 2
            break
          case '2':
            this.accessory.context.cacheTwoCurrentDoorState = newPos
            this.accessory.context.cacheTwoTargetDoorState = newPos - 2
            break
        }
        await this.funcs.sleep(2000)
        this.inUse = false
        const operationTime = newPos === 2 ? this.operationTimeUp : this.operationTimeDown
        await this.funcs.sleep(Math.max((operationTime - 20) * 100, 0))
        gcService.updateCharacteristic(this.hapChar.CurrentDoorState, newPos - 2)
        switch (v) {
          case '1':
            this.accessory.context.cacheOneCurrentDoorState = newPos - 2
            if (params.updateSource && !this.disableDeviceLogging) {
              this.log(
                '[%s] %s [garage 1 %s].',
                this.name,
                this.lang.curState,
                newPos === 2 ? this.lang.doorOpen : this.lang.doorClosed
              )
            }
            break
          case '2':
            this.accessory.context.cacheTwoCurrentDoorState = newPos - 2
            if (params.updateSource && !this.disableDeviceLogging) {
              this.log(
                '[%s] %s [garage 2 %s].',
                this.name,
                this.lang.curState,
                newPos === 2 ? this.lang.doorOpen : this.lang.doorClosed
              )
            }
            break
        }
      })
    } catch (err) {
      this.inUse = false
      this.platform.deviceUpdateError(this.accessory, err, false)
    }
  }
}
