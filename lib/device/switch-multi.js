/* jshint -W014, -W033, esversion: 9 */
/* eslint-disable new-cap */
'use strict'

module.exports = class deviceSwitchMulti {
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
    const deviceConf = platform.multiDevices[deviceId]
    this.hideChannels = deviceConf && deviceConf.hideChannels
      ? deviceConf.hideChannels
      : undefined
    this.disableDeviceLogging = deviceConf && deviceConf.overrideDisabledLogging
      ? false
      : platform.config.disableDeviceLogging

    // If the accessory has an outlet service then remove it
    if (this.accessory.getService(this.hapServ.Outlet)) {
      this.accessory.removeService(this.accessory.getService(this.hapServ.Outlet))
    }

    // Add the switch service if it doesn't already exist
    this.service = this.accessory.getService(this.hapServ.Switch) ||
      this.accessory.addService(this.hapServ.Switch)

    // Add the set handler to the switch/outlet on/off characteristic
    this.service.getCharacteristic(this.hapChar.On).onSet(async value => {
      await this.internalStateUpdate(value)
    })

    // Pass the accessory to Fakegato to set up with Eve
    this.accessory.eveService = new platform.eveService('switch', this.accessory, {
      log: platform.config.debugFakegato ? this.log : () => {}
    })

    // Output the customised options to the log if in debug mode
    if (this.debug) {
      const opts = JSON.stringify({
        disableDeviceLogging: this.disableDeviceLogging,
        hideChannels: this.hideChannels
      })
      this.log('[%s] %s %s.', this.name, this.lang.devInitOpts, opts)
    }
  }

  async internalStateUpdate (value) {
    try {
      let primaryState = false
      const params = {
        switches: []
      }
      const switchNumber = this.accessory.context.switchNumber
      switch (switchNumber) {
        case '0':
          params.switches.push({ switch: value ? 'on' : 'off', outlet: 0 })
          params.switches.push({ switch: value ? 'on' : 'off', outlet: 1 })
          params.switches.push({ switch: value ? 'on' : 'off', outlet: 2 })
          params.switches.push({ switch: value ? 'on' : 'off', outlet: 3 })
          break
        case '1':
        case '2':
        case '3':
        case '4':
          params.switches.push({ switch: value ? 'on' : 'off', outlet: switchNumber - 1 })
          break
      }
      await this.platform.sendDeviceUpdate(this.accessory, params)
      switch (switchNumber) {
        case '0':
          for (let i = 0; i <= this.accessory.context.channelCount; i++) {
            const idToCheck = this.accessory.context.eweDeviceId + 'SW' + i
            const uuid = this.platform.api.hap.uuid.generate(idToCheck)
            if (this.platform.devicesInHB.has(uuid)) {
              const subAccessory = this.platform.devicesInHB.get(uuid)
              subAccessory.getService(this.hapServ.Switch).updateCharacteristic(
                this.hapChar.On,
                value
              )
              subAccessory.eveService.addEntry({ status: value ? 1 : 0 })
              if (i > 0 && !this.disableDeviceLogging) {
                this.log(
                  '[%s] %s [%s].',
                  subAccessory.displayName,
                  this.lang.curState,
                  value ? 'on' : 'off'
                )
              }
            }
          }
          break
        case '1':
        case '2':
        case '3':
        case '4':
          for (let i = 1; i <= this.accessory.context.channelCount; i++) {
            const idToCheck = this.accessory.context.eweDeviceId + 'SW' + i
            const uuid = this.platform.api.hap.uuid.generate(idToCheck)
            if (this.platform.devicesInHB.has(uuid)) {
              const subAccessory = this.platform.devicesInHB.get(uuid)
              if (i === parseInt(switchNumber)) {
                if (value) {
                  primaryState = true
                }
                subAccessory.eveService.addEntry({ status: value ? 1 : 0 })
                if (i > 0 && !this.disableDeviceLogging) {
                  this.log(
                    '[%s] %s [%s].',
                    subAccessory.displayName,
                    this.lang.curState,
                    value ? 'on' : 'off'
                  )
                }
              } else {
                if (
                  subAccessory.getService(this.hapServ.Switch)
                    .getCharacteristic(this.hapChar.On).value
                ) {
                  primaryState = true
                }
              }
            }
          }
          if (!this.platform.hideMasters.includes(this.accessory.context.eweDeviceId)) {
            const idToCheck = this.accessory.context.eweDeviceId + 'SW0'
            const uuid = this.platform.api.hap.uuid.generate(idToCheck)
            const priAccessory = this.platform.devicesInHB.get(uuid)
            priAccessory.getService(this.hapServ.Switch).updateCharacteristic(
              this.hapChar.On,
              primaryState
            )
            priAccessory.eveService.addEntry({ status: primaryState ? 1 : 0 })
          }
          break
      }
    } catch (err) {
      this.platform.deviceUpdateError(this.accessory, err, true)
      setTimeout(() => {
        this.service.updateCharacteristic(this.hapChar.On, !value)
      }, 5000)
      throw new this.platform.api.hap.HapStatusError(-70402)
    }
  }

  async externalUpdate (params) {
    try {
      if (!params.switches) {
        return
      }
      const idToCheck = this.accessory.context.eweDeviceId + 'SW'
      let primaryState = false
      for (let i = 1; i <= this.accessory.context.channelCount; i++) {
        const uuid = this.platform.api.hap.uuid.generate(idToCheck + i)
        if (this.platform.devicesInHB.has(uuid)) {
          if (params.switches[i - 1].switch === 'on') {
            primaryState = true
          }
          const subAccessory = this.platform.devicesInHB.get(uuid)
          const service = subAccessory.getService(this.hapServ.Switch)
          const currentState = service.getCharacteristic(this.hapChar.On).value
            ? 'on'
            : 'off'
          if (params.updateSource && params.switches[i - 1].switch === currentState) {
            continue
          }
          service.updateCharacteristic(
            this.hapChar.On,
            params.switches[i - 1].switch === 'on'
          )
          subAccessory.eveService.addEntry({
            status: params.switches[i - 1].switch === 'on' ? 1 : 0
          })
          if (params.updateSource && !this.disableDeviceLogging) {
            this.log(
              '[%s] %s [%s].',
              subAccessory.displayName,
              this.lang.curState,
              params.switches[i - 1].switch
            )
          }
        }
      }
      if (!this.platform.hideMasters.includes(this.accessory.context.eweDeviceId)) {
        this.service.updateCharacteristic(this.hapChar.On, primaryState)
        this.accessory.eveService.addEntry({ status: primaryState ? 1 : 0 })
      }
    } catch (err) {
      this.platform.deviceUpdateError(this.accessory, err, false)
    }
  }
}
