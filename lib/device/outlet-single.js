/* jshint -W014, -W033, esversion: 9 */
/* eslint-disable new-cap */
'use strict'

module.exports = class deviceOutletSingle {
  constructor (platform, accessory) {
    // Set up variables from the platform
    this.consts = platform.consts
    this.debug = platform.config.debug
    this.funcs = platform.funcs
    this.hapServ = platform.api.hap.Service
    this.hapChar = platform.api.hap.Characteristic
    this.eveChar = platform.eveChar
    this.log = platform.log
    this.lang = platform.lang
    this.platform = platform

    // Set up variables from the accessory
    this.name = accessory.displayName
    this.accessory = accessory
    this.hasReadings = this.consts.devices.outlet.includes(accessory.context.eweUIID)

    // Set up custom variables for this device type
    const deviceId = this.accessory.context.eweDeviceId
    const deviceConf = platform.outletDevices[deviceId]
    this.inUsePowerThreshold = deviceConf && deviceConf.inUsePowerThreshold
      ? deviceConf.inUsePowerThreshold
      : platform.consts.defaultValues.inUsePowerThreshold
    this.disableDeviceLogging = deviceConf && deviceConf.overrideDisabledLogging
      ? false
      : platform.config.disableDeviceLogging

    // If the accessory has a switch service then remove it
    if (this.accessory.getService(this.hapServ.Switch)) {
      this.accessory.removeService(this.accessory.getService(this.hapServ.Switch))
    }

    // Add the outlet service if it doesn't already exist
    if (!(this.service = this.accessory.getService(this.hapServ.Outlet))) {
      this.service = this.accessory.addService(this.hapServ.Outlet)
      if (this.hasReadings) {
        this.service.addCharacteristic(this.eveChar.Voltage)
        this.service.addCharacteristic(this.eveChar.CurrentConsumption)
        this.service.addCharacteristic(this.eveChar.ElectricCurrent)
        this.service.addCharacteristic(this.eveChar.TotalConsumption)
        this.service.addCharacteristic(this.eveChar.ResetTotal)
      }
    }

    // Add the set handler to the outlet on/off characteristic
    this.service.getCharacteristic(this.hapChar.On).onSet(async value => {
      await this.internalStateUpdate(value)
    })

    // Pass the accessory to Fakegato to set up with Eve
    this.accessory.eveService = new platform.eveService('energy', this.accessory, {
      log: platform.config.debugFakegato ? this.log : () => {}
    })

    if (this.hasReadings) {
      // TotalConsumption is calculated by the plugin with these context readings
      if (!this.funcs.hasProperty(this.accessory.context, 'energyReadings')) {
        this.accessory.context.energyReadings = []
      }
      if (!this.funcs.hasProperty(this.accessory.context, 'energyReadingTotal')) {
        this.accessory.context.energyReadingTotal = 0
      }

      // Add the set handler to the outlet eve reset total energy characteristic
      this.service.getCharacteristic(this.eveChar.ResetTotal).onSet(value => {
        this.accessory.context.energyReadings = []
        this.accessory.context.energyReadingTotal = 0
        this.service.updateCharacteristic(this.eveChar.TotalConsumption, 0)
      })

      // Set up an interval for the plugin to calculate an approx total consumption
      this.intervalPower = setInterval(() => {
        // Every 30 seconds start with a zero reading
        let total = 0

        // Check we have had readings within the previous 30 seconds
        if (this.accessory.context.energyReadings.length > 0) {
          // Accumulate the total from the energy readings
          this.accessory.context.energyReadings.forEach(x => {
            total += x
          })

          // Divide this by the number of entries to get an average W5m
          total /= this.accessory.context.energyReadings.length

          // Convert this to Wh
          total /= 12

          // Convert this to kWh
          total /= 1000

          // Accumulate the grand total that Eve reads as the total consumption
          this.accessory.context.energyReadingTotal += total
        }

        // Reset the array for each 30 second readings
        this.accessory.context.energyReadings = []

        // Update Eve with the new grand total
        this.service.updateCharacteristic(
          this.eveChar.TotalConsumption,
          this.accessory.context.energyReadingTotal
        )
      }, 30000)

      // Set up an interval to get eWeLink to send power updates
      setTimeout(() => {
        this.internalUIUpdate()
        this.intervalPoll = setInterval(() => this.internalUIUpdate(), 60000)
      }, 5000)

      // Stop the intervals on Homebridge shutdown
      platform.api.on('shutdown', () => {
        clearInterval(this.intervalPoll)
        clearInterval(this.intervalPower)
      })
    } else {
      // Just a simple outlet model so remove any existing power characteristics
      if (this.service.testCharacteristic(this.eveChar.Voltage)) {
        this.service.removeCharacteristic(
          this.service.getCharacteristic(this.eveChar.Voltage)
        )
        this.service.removeCharacteristic(
          this.service.getCharacteristic(this.eveChar.CurrentConsumption)
        )
        this.service.removeCharacteristic(
          this.service.getCharacteristic(this.eveChar.ElectricCurrent)
        )
        this.service.removeCharacteristic(
          this.service.getCharacteristic(this.eveChar.TotalConsumption)
        )
        this.service.removeCharacteristic(
          this.service.getCharacteristic(this.eveChar.ResetTotal)
        )
        this.service.removeCharacteristic(
          this.service.getCharacteristic(this.hapChar.OutletInUse)
        )
      }
    }

    // Output the customised options to the log if in debug mode
    if (this.debug) {
      const opts = JSON.stringify({
        disableDeviceLogging: this.disableDeviceLogging,
        inUsePowerThreshold: this.inUsePowerThreshold
      })
      this.log('[%s] %s %s.', this.name, this.lang.devInitOpts, opts)
    }
  }

  async internalStateUpdate (value) {
    try {
      const newValue = value ? 'on' : 'off'
      await this.platform.sendDeviceUpdate(this.accessory, {
        switch: newValue
      })
      this.cacheState = newValue
      if (this.hasReadings && !value) {
        this.service.updateCharacteristic(this.hapChar.OutletInUse, false)
        this.service.updateCharacteristic(this.eveChar.CurrentConsumption, 0)
        this.accessory.eveService.addEntry({ power: 0 })
        this.accessory.context.energyReadings.push(0)
      }
      if (!this.disableDeviceLogging) {
        this.log('[%s] %s [%s].', this.name, this.lang.curState, this.cacheState)
      }
    } catch (err) {
      this.platform.deviceUpdateError(this.accessory, err, true)
      setTimeout(() => {
        this.service.updateCharacteristic(this.hapChar.On, this.cacheState === 'on')
      }, 5000)
      throw new this.platform.api.hap.HapStatusError(-70402)
    }
  }

  async internalUIUpdate () {
    try {
      const params = { uiActive: 60 }
      await this.platform.sendDeviceUpdate(this.accessory, params, true)
    } catch (err) {
      this.platform.deviceUpdateError(this.accessory, err, true)
    }
  }

  async externalUpdate (params) {
    try {
      if (params.switch && params.switch !== this.cacheState) {
        this.service.updateCharacteristic(this.hapChar.On, params.switch === 'on')
        this.cacheState = params.switch
        if (this.hasReadings && this.cacheState === 'off') {
          this.service.updateCharacteristic(this.hapChar.OutletInUse, false)
          this.service.updateCharacteristic(this.eveChar.CurrentConsumption, 0)
          this.accessory.eveService.addEntry({ power: 0 })
          this.accessory.context.energyReadings.push(0)
        }
        if (params.updateSource && !this.disableDeviceLogging) {
          this.log('[%s] %s [%s].', this.name, this.lang.curState, params.switch)
        }
      }
      if (!this.hasReadings) {
        return
      }
      let logger = false
      if (this.funcs.hasProperty(params, 'power')) {
        const power = parseFloat(params.power)
        this.service.updateCharacteristic(
          this.hapChar.OutletInUse,
          this.cacheState === 'on' && power > this.inUsePowerThreshold
        )
        this.service.updateCharacteristic(this.eveChar.CurrentConsumption, power)
        this.accessory.eveService.addEntry({
          power: this.cacheState === 'on' ? power : 0
        })
        this.accessory.context.energyReadings.push(power)
        logger = true
      }
      if (this.funcs.hasProperty(params, 'voltage')) {
        this.service.updateCharacteristic(
          this.eveChar.Voltage,
          parseFloat(params.voltage)
        )
        logger = true
      }
      if (this.funcs.hasProperty(params, 'current')) {
        this.service.updateCharacteristic(
          this.eveChar.ElectricCurrent,
          parseFloat(params.current)
        )
        logger = true
      }
      if (params.updateSource && logger && !this.disableDeviceLogging) {
        this.log(
          '[%s] %s%s%s.',
          this.name,
          this.funcs.hasProperty(params, 'power')
            ? ' ' + this.lang.curPower + ' [' + params.power + 'W]'
            : '',
          this.funcs.hasProperty(params, 'voltage')
            ? ' ' + this.lang.curVolt + ' [' + params.voltage + 'V]'
            : '',
          this.funcs.hasProperty(params, 'current')
            ? ' ' + this.lang.curCurr + ' [' + params.current + 'A]'
            : ''
        )
      }
    } catch (err) {
      this.platform.deviceUpdateError(this.accessory, err, false)
    }
  }
}
