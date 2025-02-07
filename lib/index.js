/* jshint -W014, -W033, esversion: 9 */
/* eslint-disable new-cap */
'use strict'

// Retrieve necessary fields from the package.json file
const PLUGIN = require('./../package.json')

// Create the platform class
class eWeLinkPlatform {
  constructor (log, config, api) {
    // Don't load the plugin if these aren't accessible for any reason
    if (!log || !api) {
      return
    }

    // Retrieve the necessary constants and functions before starting
    this.consts = require('./utils/constants')
    this.lang = require('./utils/lang-en')
    this.funcs = require('./utils/functions')

    // Begin plugin initialisation
    try {
      // Check the user has configured the plugin
      if (!config || !config.username || !config.password) {
        throw new Error(this.lang.missingCreds)
      }

      // Initialise these variables before anything else
      this.log = log
      this.api = api
      this.fanDevices = {}
      this.lightDevices = {}
      this.multiDevices = {}
      this.outletDevices = {}
      this.sensorDevices = {}
      this.singleDevices = {}
      this.thDevices = {}
      this.rfDevices = {}
      this.simulations = {}
      this.hideChannels = []
      this.hideMasters = []
      this.ipOverride = {}
      this.obstructSwitches = {}

      // Apply the user's configuration
      this.config = this.consts.defaultConfig
      this.applyUserConfig(config)

      // Create further variables needed by the plugin
      this.devicesInHB = new Map()
      this.devicesInEW = new Map()

      // Set up the Homebridge events
      this.api.on('didFinishLaunching', this.pluginSetup.bind(this))
      this.api.on('shutdown', this.pluginShutdown.bind(this))
    } catch (err) {
      // Catch any errors during initialisation
      const hideErrLines = [
        this.lang.missingCreds,
        this.lang.missingPW,
        this.lang.missingUN
      ]
      const eText = hideErrLines.includes(err.message)
        ? err.message
        : this.funcs.parseError(err)
      log.warn('***** %s [v%s]. *****', this.lang.disabling, PLUGIN.version)
      log.warn('***** %s. *****', eText)
    }
  }

  applyUserConfig (config) {
    // These shorthand functions save line space during config parsing
    const logDefault = (k, def) => {
      this.log.warn('%s [%s] %s %s.', this.lang.cfgItem, k, this.lang.cfgDef, def)
    }
    const logIgnore = k => {
      this.log.warn('%s [%s] %s.', this.lang.cfgItem, k, this.lang.cfgIgn)
    }
    const logIgnoreItem = k => {
      this.log.warn('%s [%s] %s.', this.lang.cfgItem, k, this.lang.cfgIgnItem)
    }
    const logIncrease = (k, min) => {
      this.log.warn('%s [%s] %s %s.', this.lang.cfgItem, k, this.lang.cfgLow, min)
    }
    const logQuotes = k => {
      this.log.warn('%s [%s] %s.', this.lang.cfgItem, k, this.lang.cfgQts)
    }
    const logRemove = k => {
      this.log.warn('%s [%s] %s.', this.lang.cfgItem, k, this.lang.cfgRmv)
    }

    // Begin applying the user's config
    for (const [key, val] of Object.entries(config)) {
      switch (key) {
        case 'bridgeSensors':
          if (Array.isArray(val) && val.length > 0) {
            val.forEach(x => {
              if (!x.type || !x.fullDeviceId) {
                logIgnoreItem(key)
                return
              }
              const id = this.funcs.parseDeviceId(x.fullDeviceId)
              const entries = Object.entries(x)
              if (entries.length === 1) {
                logRemove(key + '.' + id)
                return
              }
              this.rfDevices[id] = {}
              for (const [k, v] of entries) {
                switch (k) {
                  case 'fullDeviceId':
                  case 'label':
                    break
                  case 'overrideDisabledLogging':
                    if (typeof v === 'string') {
                      logQuotes(key + '.' + id + '.' + k)
                    }
                    this.rfDevices[id][k] = v === 'false' ? false : !!v
                    break
                  case 'sensorTimeDifference':
                  case 'sensorTimeLength': {
                    if (typeof v === 'string') {
                      logQuotes(key + '.' + id + '.' + k)
                    }
                    const intVal = parseInt(v)
                    if (isNaN(intVal)) {
                      logDefault(key + '.' + id + '.' + k, this.consts.defaultValues[k])
                      this.rfDevices[id][k] = this.consts.defaultValues[k]
                    } else if (intVal < this.consts.minValues[k]) {
                      logIncrease(key + '.' + id + '.' + k, this.consts.minValues[k])
                      this.rfDevices[id][k] = this.consts.minValues[k]
                    } else {
                      this.rfDevices[id][k] = intVal
                    }
                    break
                  }
                  case 'type':
                    if (typeof v !== 'string' || v === '') {
                      logIgnore(key + '.' + id + '.' + k)
                    } else if (!this.consts.allowed.sensors.includes(v)) {
                      logIgnore(key + '.' + id + '.' + k)
                    } else {
                      this.rfDevices[id][k] = v
                    }
                    break
                  default:
                    logRemove(key + '.' + id + '.' + k)
                    break
                }
              }
            })
          } else {
            logIgnore(key)
          }
          break
        case 'debug':
        case 'debugFakegato':
        case 'disableDeviceLogging':
        case 'disablePlugin':
        case 'encodedPassword':
          if (typeof val === 'string') {
            logQuotes(key)
          }
          this.config[key] = val === 'false' ? false : !!val
          break
        case 'fanDevices':
        case 'lightDevices':
        case 'multiDevices':
        case 'outletDevices':
        case 'sensorDevices':
        case 'singleDevices':
        case 'thDevices':
          if (Array.isArray(val) && val.length > 0) {
            val.forEach(x => {
              if (!x.deviceId) {
                logIgnoreItem(key)
                return
              }
              const id = this.funcs.parseDeviceId(x.deviceId)
              const entries = Object.entries(x)
              if (entries.length === 1) {
                logRemove(key + '.' + id)
                return
              }
              this[key][id] = {}
              for (const [k, v] of entries) {
                if (!this.consts.allowed[key].includes(k)) {
                  logRemove(key + '.' + id + '.' + k)
                  continue
                }
                switch (k) {
                  case 'adaptiveLightingShift':
                  case 'brightnessStep':
                  case 'inUsePowerThreshold':
                  case 'lowBattThreshold':
                  case 'minTarget':
                  case 'maxTarget':
                  case 'sensorTimeDifference': {
                    if (typeof v === 'string') {
                      logQuotes(key + '.' + id + '.' + k)
                    }
                    const intVal = parseInt(v)
                    if (isNaN(intVal)) {
                      logDefault(key + '.' + id + '.' + k, this.consts.defaultValues[k])
                      this[key][id][k] = this.consts.defaultValues[k]
                    } else if (intVal < this.consts.minValues[k]) {
                      logIncrease(key + '.' + id + '.' + k, this.consts.minValues[k])
                      this[key][id][k] = this.consts.minValues[k]
                    } else {
                      this[key][id][k] = intVal
                    }
                    break
                  }
                  case 'bulbModel': {
                    const inSet = this.consts.allowed[k].includes(v)
                    if (typeof v !== 'string' || !inSet) {
                      logIgnore(key + '.' + id + '.' + k)
                    } else {
                      this[key][id][k] = inSet
                        ? v
                        : this.consts.defaultValues[k]
                    }
                    break
                  }
                  case 'deviceId':
                  case 'label':
                    break
                  case 'hideChannels': {
                    if (typeof v !== 'string' || v === '') {
                      logIgnore(key + '.' + id + '.' + k)
                    } else {
                      const channels = v.split(',')
                      channels.forEach(channel => {
                        this.hideChannels.push(
                          id + 'SW' + channel.replace(/[^0-9]+/g, '')
                        )
                      })
                    }
                    break
                  }
                  case 'hideLight':
                  case 'hideLongDouble':
                  case 'hideSwitch':
                  case 'overrideDisabledLogging':
                  case 'scaleBattery':
                  case 'showAsOutlet':
                  case 'showAsSwitch':
                    if (typeof v === 'string') {
                      logQuotes(key + '.' + id + '.' + k)
                    }
                    this[key][id][k] = v === 'false' ? false : !!v
                    break
                  case 'ipAddress': {
                    if (typeof v !== 'string' || v === '') {
                      logIgnore(key + '.' + id + '.' + k)
                    } else {
                      this.ipOverride[id] = v
                    }
                    break
                  }
                  case 'offset': {
                    if (typeof v === 'string') {
                      logQuotes(key + '.' + id + '.' + k)
                    }
                    const numVal = Number(v)
                    if (isNaN(numVal)) {
                      logIgnore(key + '.' + id + '.' + k)
                    } else {
                      this[key][id][k] = numVal
                    }
                    break
                  }
                }
              }
            })
          } else {
            logIgnore(key)
          }
          break
        case 'groups':
          if (Array.isArray(val) && val.length > 0) {
            val.forEach(x => {
              if (!x.type || !x.deviceId) {
                logIgnoreItem(key)
                return
              }
              const id = this.funcs.parseDeviceId(x.deviceId)
              const entries = Object.entries(x)
              if (entries.length === 1) {
                logRemove(key + '.' + id)
                return
              }
              this.simulations[id] = {}
              for (const [k, v] of entries) {
                switch (k) {
                  case 'deviceId':
                  case 'label':
                    break
                  case 'ipAddress': {
                    if (typeof v !== 'string' || v === '') {
                      logIgnore(key + '.' + id + '.' + k)
                    } else {
                      this.ipOverride[id] = v
                    }
                    break
                  }
                  case 'overrideDisabledLogging':
                    if (typeof v === 'string') {
                      logQuotes(key + '.' + id + '.' + k)
                    }
                    this.simulations[id][k] = v === 'false' ? false : !!v
                    break
                  case 'obstructId':
                    if (typeof v !== 'string' || v === '') {
                      logIgnore(key + '.' + id + '.' + k)
                    } else if (!this.consts.allowed.obstructs.includes(x.type)) {
                      logIgnore(key + '.' + id + '.' + k)
                    } else {
                      const parsed = this.funcs.parseDeviceId(v)
                      this.simulations[id].obstructId = parsed
                      this.obstructSwitches[parsed] = id
                    }
                    break
                  case 'operationTime':
                  case 'operationTimeDown': {
                    if (typeof v === 'string') {
                      logQuotes(key + '.' + id + '.' + k)
                    }
                    const intVal = parseInt(v)
                    if (isNaN(intVal)) {
                      logDefault(key + '.' + id + '.' + k, this.consts.defaultValues[k])
                      this.simulations[id][k] = this.consts.defaultValues[k]
                    } else if (intVal < this.consts.minValues[k]) {
                      logIncrease(key + '.' + id + '.' + k, this.consts.minValues[k])
                      this.simulations[id][k] = this.consts.minValues[k]
                    } else {
                      this.simulations[id][k] = intVal
                    }
                    break
                  }
                  case 'sensorId':
                    if (typeof v !== 'string' || v === '') {
                      logIgnore(key + '.' + id + '.' + k)
                    } else {
                      const parsed = this.funcs.parseDeviceId(v)
                      this.simulations[id].sensorId = parsed
                    }
                    break
                  case 'setup':
                    if (typeof v !== 'string' || v === '') {
                      logIgnore(key + '.' + id + '.' + k)
                    } else if (!this.consts.allowed.setups.includes(v)) {
                      logIgnore(key + '.' + id + '.' + k)
                    } else {
                      this.simulations[id][k] = v
                    }
                    break
                  case 'type':
                    if (typeof v !== 'string' || v === '') {
                      logIgnore(key + '.' + id + '.' + k)
                    } else if (!this.consts.allowed.groupTypes.includes(x.type)) {
                      logIgnore(key + '.' + id + '.' + k)
                    } else {
                      this.simulations[id][k] = v
                    }
                    break
                  default:
                    logRemove(key + '.' + id + '.' + k)
                    break
                }
              }
            })
          } else {
            logIgnore(key)
          }
          break
        case 'ignoredDevices': {
          if (Array.isArray(val)) {
            if (val.length > 0) {
              val.forEach(deviceId => {
                this.config.ignoredDevices.push(
                  this.funcs.parseDeviceId(deviceId)
                )
              })
            } else {
              logRemove(key)
            }
          } else {
            logIgnore(key)
          }
          break
        }
        case 'mode': {
          const inSet = this.consts.allowed.modes.includes(val)
          if (typeof val !== 'string' || !inSet) {
            logIgnore(key)
          }
          this.config.mode = inSet ? val : this.consts.defaultValues[key]
          break
        }
        case 'name':
        case 'platform':
        case 'plugin_map':
          break
        case 'password':
          if (typeof val !== 'string' || val === '') {
            throw new Error(this.lang.missingPW)
          }
          this.config.password = val
          break
        case 'username':
          if (typeof val !== 'string' || val === '') {
            throw new Error(this.lang.missingUN)
          }
          this.config.username = val.replace(/[\s]+/g, '')
          break
        default:
          logRemove(key)
          break
      }
    }
  }

  async pluginSetup () {
    // Plugin has finished initialising so now onto setup
    try {
      // If the user has disabled the plugin then remove all accessories
      if (this.config.disablePlugin) {
        this.devicesInHB.forEach(accessory => {
          this.removeAccessory(accessory)
        })
        throw new Error(this.lang.disabled)
      }

      // Log that the plugin initialisation has been successful
      this.log('[v%s] %s.', PLUGIN.version, this.lang.initialised)

      // Require any libraries that the plugin uses
      this.axios = require('axios')
      this.crypto = require('crypto')
      this.colourUtils = require('./utils/colour-utils')
      this.eveService = require('./fakegato/fakegato-history')(this.api)
      this.eveChar = new (require('./utils/eve-chars'))(this.api)
      const { default: PQueue } = require('p-queue')

      // Create the queue used for sending device updates
      this.queue = new PQueue({
        interval: 250,
        intervalCap: 1,
        timeout: 10000
      })

      // Check to see if the user has encoded their password
      if (this.config.encodedPassword) {
        const buff = Buffer.from(this.config.password, 'base64')
        this.config.password = buff.toString('utf8').replace(/(\r\n|\n|\r)/gm, '').trim()
      }

      // Set up the HTTP client, get the user HTTP host, and login
      this.httpClient = new (require('./connection/http'))(this)
      const authData = await this.httpClient.login()

      // Get a device list and add to the devicesInEW map
      const deviceList = await this.httpClient.getDevices()
      deviceList.forEach(device => {
        this.devicesInEW.set(device.deviceid, device)
      })

      // Set up the WS client, get the user WS host, and login
      if (this.config.mode !== 'lan') {
        this.wsClient = new (require('./connection/ws'))(this, authData)
        await this.wsClient.login()
      }

      // Set up the LAN client, scan for devices and start monitoring
      if (this.config.mode !== 'wan') {
        this.lanClient = new (require('./connection/lan'))(this, deviceList)
        this.lanDevices = await this.lanClient.getHosts()
        await this.lanClient.startMonitor()
      }

      // Remove HB accessories that are no longer in eWeLink account
      this.devicesInHB.forEach(accessory => {
        if (!this.devicesInEW.has(accessory.context.eweDeviceId)) {
          this.removeAccessory(accessory)
        }
      })

      // Initialise each device into HB
      this.devicesInEW.forEach(device => this.initialiseDevice(device))

      // Set up the WS and LAN listener for device updates
      if (this.wsClient) {
        this.wsClient.receiveUpdate(device => this.receiveDeviceUpdate(device))
      }
      if (this.lanClient) {
        this.lanClient.receiveUpdate(device => this.receiveDeviceUpdate(device))
      }

      // Refresh the WS connection every 60 minutes
      if (this.wsClient) {
        this.wsRefresh = setInterval(async () => {
          try {
            if (this.config.debug) {
              this.log('%s.', this.lang.wsRef)
            }
            await this.wsClient.login()
          } catch (e) {
            const eText = this.funcs.parseError(e)
            this.log.warn('%s %s.', this.lang.wsRefFail, eText)
          }
        }, 3600000)
      }

      // Log that the plugin setup has been successful with a welcome message
      const randIndex = Math.floor(Math.random() * this.lang.zWelcome.length)
      this.log('%s. %s', this.lang.complete, this.lang.zWelcome[randIndex])
    } catch (err) {
      // Catch any errors during setup
      const eText = err.message === this.lang.disabled
        ? err.message
        : this.config.debug
          ? err
          : this.funcs.parseError(err)
      this.log.warn('***** %s [v%s]. *****', this.lang.disabling, PLUGIN.version)
      this.log.warn('***** %s. *****', eText)
      this.pluginShutdown()
    }
  }

  pluginShutdown () {
    // A function that is called when the plugin fails to load or Homebridge restarts
    try {
      // Stop the LAN monitoring
      if (this.lanClient) {
        this.lanClient.closeConnection()
      }

      // Close the WS connection
      if (this.wsClient) {
        clearInterval(this.wsRefresh)
        this.wsClient.closeConnection()
      }
    } catch (err) {
      // No need to show errors at this point
    }
  }

  initialiseDevice (device) {
    try {
      let accessory
      const uiid = device.extra && device.extra.uiid ? device.extra.uiid : 0
      const uuid = this.api.hap.uuid.generate(device.deviceid + 'SWX')

      // Remove old sub accessories for Accessory Simulations and DUALR3 in motor mode
      if (
        this.simulations[device.deviceid] ||
        (this.consts.devices.doubleSwitch.includes(uiid) && device.params.workMode === 2)
      ) {
        for (let i = 0; i <= 4; i++) {
          const uuidsub = this.api.hap.uuid.generate(device.deviceid + 'SW' + i)
          if (this.devicesInHB.has(uuidsub)) {
            this.removeAccessory(this.devicesInHB.get(uuidsub))
          }
        }
      }

      // Set up the correct instance for this particular device
      if (this.consts.devices.curtain.includes(uiid)) {
        /***********************
        BLINDS [EWELINK UIID 11]
        ***********************/
        accessory = this.devicesInHB.has(uuid)
          ? this.devicesInHB.get(uuid)
          : this.addAccessory(device, device.deviceid + 'SWX')
        accessory.control = new (require('./device/curtain'))(this, accessory)
        /**********************/
      } else if (
        this.consts.devices.doubleSwitch.includes(uiid) &&
        device.params.workMode === 2
      ) {
        /*************************
        BLINDS [DUALR3 MOTOR MODE]
        *************************/
        accessory = this.devicesInHB.has(uuid)
          ? this.devicesInHB.get(uuid)
          : this.addAccessory(device, device.deviceid + 'SWX')
        accessory.control = new (require('./device/motor'))(this, accessory)
        /************************/
      } else if (
        this.simulations[device.deviceid] &&
        this.simulations[device.deviceid].type === 'blind'
      ) {
        /****************************
        BLINDS [ACCESSORY SIMULATION]
        ****************************/
        accessory = this.devicesInHB.has(uuid)
          ? this.devicesInHB.get(uuid)
          : this.addAccessory(device, device.deviceid + 'SWX')
        accessory.control = new (require('./device/simulation/blind'))(this, accessory)
        /***************************/
      } else if (
        this.simulations[device.deviceid] &&
        this.simulations[device.deviceid].type === 'door'
      ) {
        /***************************
        DOORS [ACCESSORY SIMULATION]
        ***************************/
        accessory = this.devicesInHB.has(uuid)
          ? this.devicesInHB.get(uuid)
          : this.addAccessory(device, device.deviceid + 'SWX')
        accessory.control = new (require('./device/simulation/door'))(this, accessory)
        /**************************/
      } else if (
        this.simulations[device.deviceid] &&
        this.simulations[device.deviceid].type === 'window'
      ) {
        /*****************************
        WINDOWS [ACCESSORY SIMULATION]
        *****************************/
        accessory = this.devicesInHB.has(uuid)
          ? this.devicesInHB.get(uuid)
          : this.addAccessory(device, device.deviceid + 'SWX')
        accessory.control = new (require('./device/simulation/window'))(this, accessory)
        /****************************/
      } else if (this.obstructSwitches[device.deviceid]) {
        /*****************************
        OBSTRUCTION DETECTION SWITCHES
        *****************************/
        const instance = './device/simulation/garage-od-switch'
        accessory = this.addAccessory(device, device.deviceid + 'SWX', true)
        accessory.control = new (require(instance))(this, accessory)
        /****************************/
      } else if (
        this.simulations[device.deviceid] &&
        this.simulations[device.deviceid].type === 'garage'
      ) {
        /****************************************
        GARAGE DOORS [ONE] [ACCESSORY SIMULATION]
        ****************************************/
        const instance = './device/simulation/garage-one'
        accessory = this.devicesInHB.has(uuid)
          ? this.devicesInHB.get(uuid)
          : this.addAccessory(device, device.deviceid + 'SWX')
        accessory.control = new (require(instance))(this, accessory)
        /***************************************/
      } else if (
        this.simulations[device.deviceid] &&
        this.simulations[device.deviceid].type === 'garage_two'
      ) {
        /****************************************
        GARAGE DOORS [TWO] [ACCESSORY SIMULATION]
        ****************************************/
        const instance = './device/simulation/garage-two'
        accessory = this.devicesInHB.has(uuid)
          ? this.devicesInHB.get(uuid)
          : this.addAccessory(device, device.deviceid + 'SWX')
        accessory.control = new (require(instance))(this, accessory)
        /***************************************/
      } else if (
        this.simulations[device.deviceid] &&
        this.simulations[device.deviceid].type === 'garage_four'
      ) {
        /*****************************************
        GARAGE DOORS [FOUR] [ACCESSORY SIMULATION]
        *****************************************/
        const instance = './device/simulation/garage-four'
        accessory = this.devicesInHB.has(uuid)
          ? this.devicesInHB.get(uuid)
          : this.addAccessory(device, device.deviceid + 'SWX')
        accessory.control = new (require(instance))(this, accessory)
        /****************************************/
      } else if (
        this.simulations[device.deviceid] &&
        this.simulations[device.deviceid].type === 'garage_eachen'
      ) {
        /***************************
        GARAGE DOORS [EACHEN GD-DC5]
        ***************************/
        const instance = './device/simulation/garage-eachen'
        accessory = this.devicesInHB.has(uuid)
          ? this.devicesInHB.get(uuid)
          : this.addAccessory(device, device.deviceid + 'SWX')
        accessory.control = new (require(instance))(this, accessory)
        /**************************/
      } else if (
        this.simulations[device.deviceid] &&
        this.simulations[device.deviceid].type === 'lock'
      ) {
        /***************************
        LOCKS [ACCESSORY SIMULATION]
        ***************************/
        accessory = this.devicesInHB.has(uuid)
          ? this.devicesInHB.get(uuid)
          : this.addAccessory(device, device.deviceid + 'SWX')
        accessory.control = new (require('./device/simulation/lock-one'))(this, accessory)
        /**************************/
      } else if (
        this.simulations[device.deviceid] &&
        this.simulations[device.deviceid].type === 'switch_valve'
      ) {
        /**********************************
        SWITCH-VALVE [ACCESSORY SIMULATION]
        **********************************/
        const instance = './device/simulation/switch-valve'
        accessory = this.devicesInHB.has(uuid)
          ? this.devicesInHB.get(uuid)
          : this.addAccessory(device, device.deviceid + 'SWX')
        accessory.control = new (require(instance))(this, accessory)
        /*********************************/
      } else if (
        this.simulations[device.deviceid] &&
        this.simulations[device.deviceid].type === 'tap'
      ) {
        /********************************
        TAPS [ONE] [ACCESSORY SIMULATION]
        ********************************/
        accessory = this.devicesInHB.has(uuid)
          ? this.devicesInHB.get(uuid)
          : this.addAccessory(device, device.deviceid + 'SWX')
        accessory.control = new (require('./device/simulation/tap-one'))(this, accessory)
        /*******************************/
      } else if (
        this.simulations[device.deviceid] &&
        this.simulations[device.deviceid].type === 'tap_two'
      ) {
        /********************************
        TAPS [TWO] [ACCESSORY SIMULATION]
        ********************************/
        accessory = this.devicesInHB.has(uuid)
          ? this.devicesInHB.get(uuid)
          : this.addAccessory(device, device.deviceid + 'SWX')
        accessory.control = new (require('./device/simulation/tap-two'))(this, accessory)
        /*******************************/
      } else if (
        this.simulations[device.deviceid] &&
        this.simulations[device.deviceid].type === 'valve'
      ) {
        /**********************************
        VALVES [ONE] [ACCESSORY SIMULATION]
        **********************************/
        const instance = './device/simulation/valve-one'
        accessory = this.devicesInHB.has(uuid)
          ? this.devicesInHB.get(uuid)
          : this.addAccessory(device, device.deviceid + 'SWX')
        accessory.control = new (require(instance))(this, accessory)
        /*********************************/
      } else if (
        this.simulations[device.deviceid] &&
        this.simulations[device.deviceid].type === 'valve_two'
      ) {
        /**********************************
        VALVES [TWO] [ACCESSORY SIMULATION]
        **********************************/
        const instance = './device/simulation/valve-two'
        accessory = this.devicesInHB.has(uuid)
          ? this.devicesInHB.get(uuid)
          : this.addAccessory(device, device.deviceid + 'SWX')
        accessory.control = new (require(instance))(this, accessory)
        /*********************************/
      } else if (
        this.simulations[device.deviceid] &&
        this.simulations[device.deviceid].type === 'valve_four'
      ) {
        /***********************************
        VALVES [FOUR] [ACCESSORY SIMULATION]
        ***********************************/
        const instance = './device/simulation/valve-four'
        accessory = this.devicesInHB.has(uuid)
          ? this.devicesInHB.get(uuid)
          : this.addAccessory(device, device.deviceid + 'SWX')
        accessory.control = new (require(instance))(this, accessory)
        /**********************************/
      } else if (
        this.simulations[device.deviceid] &&
        this.simulations[device.deviceid].type === 'sensor_leak' &&
        this.consts.devices.sensorContact.includes(uiid)
      ) {
        /**************************************
        SENSORS [LEAK DW2 ACCESSORY SIMULATION]
        **************************************/
        const instance = './device/simulation/sensor-leak'
        accessory = this.devicesInHB.has(uuid)
          ? this.devicesInHB.get(uuid)
          : this.addAccessory(device, device.deviceid + 'SWX')
        accessory.control = new (require(instance))(this, accessory)
        /*************************************/
      } else if (this.consts.devices.sensorContact.includes(uiid)) {
        /*******************
        SENSORS [SONOFF DW2]
        *******************/
        accessory = this.devicesInHB.has(uuid)
          ? this.devicesInHB.get(uuid)
          : this.addAccessory(device, device.deviceid + 'SWX')
        accessory.control = new (require('./device/sensor-contact'))(this, accessory)
        /******************/
      } else if (this.consts.devices.fan.includes(uiid)) {
        /***
        FANS
        ***/
        accessory = this.devicesInHB.has(uuid)
          ? this.devicesInHB.get(uuid)
          : this.addAccessory(device, device.deviceid + 'SWX')
        accessory.control = new (require('./device/fan'))(this, accessory)
        /**/
      } else if (this.consts.devices.diffuser.includes(uiid)) {
        /********
        DIFFUSERS
        ********/
        accessory = this.devicesInHB.has(uuid)
          ? this.devicesInHB.get(uuid)
          : this.addAccessory(device, device.deviceid + 'SWX')
        accessory.control = new (require('./device/diffuser'))(this, accessory)
        /*******/
      } else if (this.consts.devices.humidifier.includes(uiid)) {
        /**********
        HUMIDIFIERS
        **********/
        accessory = this.devicesInHB.has(uuid)
          ? this.devicesInHB.get(uuid)
          : this.addAccessory(device, device.deviceid + 'SWX')
        accessory.control = new (require('./device/humidifier'))(this, accessory)
        /*********/
      } else if (this.consts.devices.thermostat.includes(uiid)) {
        /**********
        THERMOSTATS
        **********/
        accessory = this.devicesInHB.has(uuid)
          ? this.devicesInHB.get(uuid)
          : this.addAccessory(device, device.deviceid + 'SWX')
        accessory.control = new (require('./device/thermostat'))(this, accessory)
        /*******/
      } else if (
        this.simulations[device.deviceid] &&
        this.simulations[device.deviceid].type === 'thermostat' &&
        this.consts.devices.sensorAmbient.includes(uiid)
      ) {
        /*********************************
        THERMOSTATS [ACCESSORY SIMULATION]
        *********************************/
        const instance = './device/simulation/thermostat'
        accessory = this.devicesInHB.has(uuid)
          ? this.devicesInHB.get(uuid)
          : this.addAccessory(device, device.deviceid + 'SWX')
        accessory.control = new (require(instance))(this, accessory)
        /********************************/
      } else if (this.consts.devices.sensorAmbient.includes(uiid)) {
        /***********************
        SENSOR [AMBIENT-TH10/16]
        ***********************/
        accessory = this.devicesInHB.has(uuid)
          ? this.devicesInHB.get(uuid)
          : this.addAccessory(device, device.deviceid + 'SWX')
        accessory.context.sensorType = device.params.sensorType
        accessory.control = new (require('./device/sensor-ambient'))(this, accessory)
        /**********************/
      } else if (this.consts.devices.sensorTempHumi.includes(uiid)) {
        /*************************
        SENSOR [AMBIENT-SONOFF SC]
        *************************/
        accessory = this.devicesInHB.has(uuid)
          ? this.devicesInHB.get(uuid)
          : this.addAccessory(device, device.deviceid + 'SWX')
        accessory.control = new (require('./device/sensor-temp-humi'))(this, accessory)
        /************************/
      } else if (
        this.consts.devices.outlet.includes(uiid) ||
        (
          this.consts.devices.singleSwitch.includes(uiid) &&
          this.consts.devices.singleSwitchOutlet.includes(device.productModel)
        )
      ) {
        /******
        OUTLETS
        ******/
        accessory = this.devicesInHB.has(uuid)
          ? this.devicesInHB.get(uuid)
          : this.addAccessory(device, device.deviceid + 'SWX')
        accessory.control = this.outletDevices[device.deviceid] &&
          this.outletDevices[device.deviceid].showAsSwitch
          ? new (require('./device/switch-single'))(this, accessory)
          : new (require('./device/outlet-single'))(this, accessory)
        /*****/
      } else if (this.consts.devices.outletSCM.includes(uiid)) {
        /*************************************
        OUTLETS [SINGLE BUT MULTIPLE HARDWARE]
        *************************************/
        accessory = this.devicesInHB.has(uuid)
          ? this.devicesInHB.get(uuid)
          : this.addAccessory(device, device.deviceid + 'SWX')
        accessory.control = new (require('./device/outlet-scm'))(this, accessory)
        /************************************/
      } else if (this.consts.devices.lightRGB.includes(uiid)) {
        /***********
        LIGHTS [RGB]
        ***********/
        accessory = this.devicesInHB.has(uuid)
          ? this.devicesInHB.get(uuid)
          : this.addAccessory(device, device.deviceid + 'SWX')
        accessory.control = new (require('./device/light-rgb'))(this, accessory)
        /**********/
      } else if (this.consts.devices.lightCCT.includes(uiid)) {
        /***********
        LIGHTS [CCT]
        ***********/
        accessory = this.devicesInHB.has(uuid)
          ? this.devicesInHB.get(uuid)
          : this.addAccessory(device, device.deviceid + 'SWX')
        accessory.control = new (require('./device/light-cct'))(this, accessory)
        /**********/
      } else if (this.consts.devices.lightRGBCCT.includes(uiid)) {
        /*****************
        LIGHTS [RGB & CCT]
        *****************/
        accessory = this.devicesInHB.has(uuid)
          ? this.devicesInHB.get(uuid)
          : this.addAccessory(device, device.deviceid + 'SWX')
        accessory.control = new (require('./device/light-rgb-cct'))(this, accessory)
        /****************/
      } else if (this.consts.devices.lightDimmer.includes(uiid)) {
        /**************
        LIGHTS [DIMMER]
        **************/
        accessory = this.devicesInHB.has(uuid)
          ? this.devicesInHB.get(uuid)
          : this.addAccessory(device, device.deviceid + 'SWX')
        accessory.control = new (require('./device/light-dimmer'))(this, accessory)
        /*************/
      } else if (this.consts.devices.singleSwitch.includes(uiid)) {
        /************************
        SWITCHES [SINGLE CHANNEL]
        ************************/
        accessory = this.devicesInHB.has(uuid)
          ? this.devicesInHB.get(uuid)
          : this.addAccessory(device, device.deviceid + 'SWX')
        accessory.control = this.singleDevices[device.deviceid] &&
          this.singleDevices[device.deviceid].showAsOutlet
          ? new (require('./device/outlet-single'))(this, accessory)
          : new (require('./device/switch-single'))(this, accessory)
        /***********************/
      } else if (
        this.consts.devices.doubleSwitch.includes(uiid) ||
        this.consts.devices.multiSwitch.includes(uiid)
      ) {
        /***********************
        SWITCHES [MULTI CHANNEL]
        ***********************/
        for (let i = 0; i <= this.consts.supportedDevices[uiid]; i++) {
          let subAccessory
          const uuidsub = this.api.hap.uuid.generate(device.deviceid + 'SW' + i)

          // Check if the user has chosen to hide any channels for this device
          if (this.hideChannels.includes(device.deviceid + 'SW' + i)) {
            // The user has hidden this channel so if it exists then remove it
            if (this.devicesInHB.has(uuidsub)) {
              this.removeAccessory(this.devicesInHB.get(uuidsub))
            }

            // If this is the main channel then add it to the array of hidden masters
            if (i === 0) {
              this.hideMasters.push(device.deviceid)
            }

            // Add the sub accessory, but hidden, to Homebridge
            subAccessory = this.addAccessory(device, device.deviceid + 'SW' + i, true)
          } else {
            // The user has not hidden this channel
            subAccessory = this.devicesInHB.has(uuidsub)
              ? this.devicesInHB.get(uuidsub)
              : this.addAccessory(device, device.deviceid + 'SW' + i)
          }

          // Add context information to the sub accessory
          subAccessory.context.firmware = device.params.fwVersion || PLUGIN.version
          subAccessory.context.reachableWAN = device.online
          subAccessory.context.reachableLAN = this.lanClient &&
            this.lanDevices.has(device.deviceid)
            ? this.lanDevices.get(device.deviceid).ip
            : false
          subAccessory.context.eweBrandName = device.brandName
          subAccessory.context.eweBrandLogo = device.brandLogo
          subAccessory.context.eweShared = device.sharedBy && device.sharedBy.email
            ? device.sharedBy.email
            : false
          subAccessory.context.ip = this.lanClient && subAccessory.context.reachableLAN
            ? this.lanDevices.get(device.deviceid).ip
            : false
          subAccessory.control = this.consts.devices.doubleSwitch.includes(uiid)
            ? this.multiDevices[device.deviceid] &&
              this.multiDevices[device.deviceid].showAsOutlet
              ? new (require('./device/outlet-double'))(this, subAccessory)
              : new (require('./device/switch-double'))(this, subAccessory)
            : this.multiDevices[device.deviceid] &&
              this.multiDevices[device.deviceid].showAsOutlet
              ? new (require('./device/outlet-multi'))(this, subAccessory)
              : new (require('./device/switch-multi'))(this, subAccessory)

          // Update any changes to the sub accessory to the platform
          this.api.updatePlatformAccessories(PLUGIN.name, PLUGIN.alias, [subAccessory])
          this.devicesInHB.set(subAccessory.UUID, subAccessory)
          if (i === 0) {
            accessory = subAccessory
          }
        }
        /**********************/
      } else if (this.consts.devices.rfBridge.includes(uiid)) {
        /*********************
        RF BRIDGE + SUBDEVICES
        *********************/
        let rfChlCounter = 0

        // Make an array of sub devices connected to the RF Bridge
        const rfMap = []
        if (device.tags && device.tags.zyx_info) {
          device.tags.zyx_info.forEach(remote =>
            rfMap.push({
              name: remote.name,
              type: remote.remote_type,
              buttons: Object.assign({}, ...remote.buttonName)
            })
          )
        }
        accessory = this.addAccessory(
          device, device.deviceid + 'SW0', true, { rfMap }, 'rf_pri'
        )
        accessory.control = new (require('./device/rf-bridge'))(this, accessory)

        // We don't want to add the main bridge as an accessory in Homebridge
        this.hideMasters.push(device.deviceid)

        // Loop through each sub device connected to the RF Bridge
        rfMap.forEach(subDevice => {
          const swNumber = rfChlCounter + 1
          let subAccessory
          let subType
          let sensorTimeLength
          let sensorTimeDiff
          let subExtraContext = {}
          const fullDeviceId = device.deviceid + 'SW' + swNumber
          const uuidsub = this.api.hap.uuid.generate(fullDeviceId)
          const disableDeviceLogging = this.rfDevices[fullDeviceId] &&
            this.rfDevices[fullDeviceId].overrideDisabledLogging
            ? false
            : this.config.disableDeviceLogging

          // Check which eWeLink type the connected sub device is
          switch (subDevice.type) {
            case '1':
            case '2':
            case '3':
            case '4':
              subType = 'button'
              break
            case '5':
              subType = 'curtain'
              break
            case '6':
            case '7':
              subType = this.rfDevices[fullDeviceId]
                ? this.rfDevices[fullDeviceId].type
                : 'motion'
              sensorTimeLength = this.rfDevices[fullDeviceId] &&
                this.rfDevices[fullDeviceId].sensorTimeLength
                ? this.rfDevices[fullDeviceId].sensorTimeLength
                : this.consts.defaultValues.sensorTimeLength
              sensorTimeDiff = this.rfDevices[fullDeviceId] &&
                this.rfDevices[fullDeviceId].sensorTimeDifference
                ? this.rfDevices[fullDeviceId].sensorTimeDifference
                : this.consts.defaultValues.sensorTimeDifference
              break
            default: {
              this.log.warn('[%s] %s:', device.name, this.lang.devNotSupYet)
              const data = JSON.stringify(device.params)
              this.log.warn('[%s-%s] %s', uiid, subDevice.type || '?', data)
              return
            }
          }

          // Create an object to save to the sub accessory context
          subExtraContext = {
            buttons: subDevice.buttons,
            subType,
            swNumber,
            sensorTimeLength,
            sensorTimeDiff,
            disableDeviceLogging,
            name: subDevice.name
          }

          // Check if the sub accessory already exists in Homebridge
          if ((subAccessory = this.devicesInHB.get(uuidsub))) {
            // Check for any changes to user config or types
            if (
              subAccessory.context.subType !== subType ||
              subAccessory.context.sensorTimeLength !== sensorTimeLength ||
              subAccessory.context.sensorTimeDiff !== sensorTimeDiff ||
              subAccessory.context.disableDeviceLogging !== disableDeviceLogging ||
              subAccessory.context.swNumber !== swNumber
            ) {
              // Remove the existing sub accessory if any changes are found
              this.removeAccessory(subAccessory)
            }
          }

          // Get the sub accessory if it's new or hasn't been removed above

          subAccessory = this.devicesInHB.has(uuidsub)
            ? this.devicesInHB.get(uuidsub)
            : this.addAccessory(device, fullDeviceId, false, subExtraContext, 'rf_sub')

          // Add context information to the sub accessory
          subAccessory.context.firmware = device.params.fwVersion || PLUGIN.version
          subAccessory.context.reachableWAN = device.online
          subAccessory.context.reachableLAN = false
          subAccessory.context.eweBrandName = device.brandName
          subAccessory.context.eweBrandLogo = device.brandLogo
          subAccessory.context.eweShared = device.sharedBy && device.sharedBy.email
            ? device.sharedBy.email
            : false
          subAccessory.context.ip = this.lanClient && subAccessory.context.reachableLAN
            ? this.lanDevices.get(device.deviceid).ip
            : false

          // Update any changes to the sub accessory to the platform
          this.api.updatePlatformAccessories(PLUGIN.name, PLUGIN.alias, [subAccessory])
          this.devicesInHB.set(subAccessory.UUID, subAccessory)
          subAccessory.control = new (require('./device/rf-bridge'))(this, subAccessory)
          rfChlCounter += Object.keys(subDevice.buttons || {}).length
        })

        // Update any changes to the accessory to the platform
        accessory.context.channelCount = rfChlCounter
        /********************/
      } else if (this.consts.devices.zbBridge.includes(uiid)) {
        /************
        ZIGBEE BRIDGE
        ************/
        return
        /***********/
      } else if (this.consts.devices.zbSwitchStateless.includes(uiid)) {
        /**********************
        ZIGBEE STATELESS SWITCH
        **********************/
        const instance = './device/zigbee/switch-stateless'
        accessory = this.devicesInHB.has(uuid)
          ? this.devicesInHB.get(uuid)
          : this.addAccessory(device, device.deviceid + 'SWX')
        accessory.control = new (require(instance))(this, accessory)
        /*********************/
      } else if (this.consts.devices.zbSwitchSingle.includes(uiid)) {
        /***************
        ZB SINGLE SWITCH
        ***************/
        const instance = './device/zigbee/switch-single'
        accessory = this.devicesInHB.has(uuid)
          ? this.devicesInHB.get(uuid)
          : this.addAccessory(device, device.deviceid + 'SWX')
        accessory.control = new (require(instance))(this, accessory)
        /**************/
      } else if (this.consts.devices.zbLightDimmer.includes(uiid)) {
        /*****************
        ZB LIGHTS [DIMMER]
        *****************/
        accessory = this.devicesInHB.has(uuid)
          ? this.devicesInHB.get(uuid)
          : this.addAccessory(device, device.deviceid + 'SWX')
        accessory.control = new (require('./device/zigbee/light-dimmer'))(this, accessory)
        /****************/
      } else if (this.consts.devices.zbLightCCT.includes(uiid)) {
        /**************
        ZB LIGHTS [CCT]
        **************/
        accessory = this.devicesInHB.has(uuid)
          ? this.devicesInHB.get(uuid)
          : this.addAccessory(device, device.deviceid + 'SWX')
        accessory.control = new (require('./device/zigbee/light-cct'))(this, accessory)
        /*************/
      } else if (this.consts.devices.zbSensorAmbient.includes(uiid)) {
        /******************
        ZB SENSOR [AMBIENT]
        ******************/
        const instance = './device/zigbee/sensor-ambient'
        accessory = this.devicesInHB.has(uuid)
          ? this.devicesInHB.get(uuid)
          : this.addAccessory(device, device.deviceid + 'SWX')
        accessory.control = new (require(instance))(this, accessory)
        /*****************/
      } else if (this.consts.devices.zbSensorMotion.includes(uiid)) {
        /*****************
        ZB SENSOR [MOTION]
        *****************/
        const instance = './device/zigbee/sensor-motion'
        accessory = this.devicesInHB.has(uuid)
          ? this.devicesInHB.get(uuid)
          : this.addAccessory(device, device.deviceid + 'SWX')
        accessory.control = new (require(instance))(this, accessory)
        /****************/
      } else if (this.consts.devices.zbSensorContact.includes(uiid)) {
        /******************
        ZB SENSOR [CONTACT]
        ******************/
        const instance = './device/zigbee/sensor-contact'
        accessory = this.devicesInHB.has(uuid)
          ? this.devicesInHB.get(uuid)
          : this.addAccessory(device, device.deviceid + 'SWX')
        accessory.control = new (require(instance))(this, accessory)
        /*****************/
      } else if (this.consts.devices.camera.includes(uiid)) {
        /*************
        SONOFF CAMERAS
        *************/
        this.log('[%s] %s.', device.name, this.lang.sonoffCamera)
        return
        /************/
      } else if (this.consts.devices.cannotSupport.includes(uiid)) {
        /*******************************
        DEVICES THAT CANNOT BE SUPPORTED
        *******************************/
        this.log('[%s] %s.', device.name, this.lang.devNotSup)
        return
        /******************************/
      } else {
        /**********************
        DEVICES PENDING SUPPORT
        **********************/
        this.log.warn('[%s] %s:', device.name, this.lang.devNotSupYet)
        this.log.warn('[%s] %s', uiid || '?', JSON.stringify(device.params))
        return
        /*********************/
      }

      // Update the reachability values (via WS and LAN)
      accessory.context.firmware = device.params.fwVersion || PLUGIN.version
      accessory.context.reachableWAN = device.online
      accessory.context.reachableLAN = this.lanClient &&
        this.lanDevices.has(device.deviceid)
        ? this.lanDevices.get(device.deviceid).ip
        : false
      accessory.context.eweBrandName = device.brandName
      accessory.context.eweBrandLogo = device.brandLogo
      accessory.context.eweShared = device.sharedBy && device.sharedBy.email
        ? device.sharedBy.email
        : false
      accessory.context.ip = this.lanClient && accessory.context.reachableLAN
        ? this.lanDevices.get(device.deviceid).ip
        : false

      // Helpful logging for each device
      const str = accessory.context.reachableLAN
        ? this.lang.foundWithIP + ' [' + this.lanDevices.get(device.deviceid).ip + ']'
        : this.consts.devices.lanIn.includes(uiid)
          ? this.lang.lanUnreachable
          : this.lang.lanUnsupported

      // Update accessory characteristics with latest values
      if (this.wsClient && accessory.control && accessory.control.externalUpdate) {
        accessory.control.externalUpdate(device.params)

        // Mark the online/offline status of certain devices
        if (this.consts.devices.markStatus.includes(accessory.context.eweUIID)) {
          accessory.control.markStatus(device.online)
        }
      }

      // Update any changes to the device into our devicesInHB map
      this.api.updatePlatformAccessories(PLUGIN.name, PLUGIN.alias, [accessory])
      this.devicesInHB.set(accessory.UUID, accessory)
      this.log('[%s] %s %s.', device.name, this.lang.devInit, str)
      if (
        this.config.mode === 'lan' &&
        !this.consts.devices.lanOut.includes(uiid)
      ) {
        this.log.warn('[%s] %s.', device.name, this.lang.devNoControl)
      }
    } catch (err) {
      // Catch any errors during initialisation
      const eText = this.funcs.parseError(err)
      this.log.warn('[%s] %s %s.', device.name, this.lang.devNotInit, eText)
    }
  }

  addAccessory (device, hbDeviceId, hidden = false, extraContext = {}, type = '') {
    // Add an accessory to Homebridge
    let newDeviceName
    try {
      // Get the switchNumber which can be {X, 0, 1, 2, 3, 4, ...}
      const switchNumber = hbDeviceId.split('SW')[1].toString()
      const channelCount = type === 'rf_pri'
        ? Object.keys((device.tags && device.tags.zyx_info) || []).length
        : this.consts.supportedDevices[device.extra.uiid]

      // Set up the device name which can depend on the accessory type
      if (type === 'rf_sub') {
        // RF accessories have their name stored in the context
        newDeviceName = extraContext.name
      } else {
        // Other accessories store the name initially as the device name
        newDeviceName = device.name

        // Check if it's a channel of a multi-channel device
        if (['1', '2', '3', '4'].includes(switchNumber)) {
          // Try and obtain the eWeLink channel name
          if (
            device.tags &&
            device.tags.ck_channel_name &&
            device.tags.ck_channel_name[parseInt(switchNumber) - 1]
          ) {
            // Found the eWeLink channel name
            newDeviceName = device.tags.ck_channel_name[parseInt(switchNumber) - 1]
          } else {
            // Didn't find the eWeLink channel name use generic SW channel
            newDeviceName += ' SW' + switchNumber
          }
        }
      }

      // Add the new accessory to Homebridge
      const accessory = new this.api.platformAccessory(
        newDeviceName,
        this.api.hap.uuid.generate(hbDeviceId)
      )

      // If it isn't a hidden device then set the accessory characteristics
      if (!hidden) {
        accessory.getService(this.api.hap.Service.AccessoryInformation)
          .setCharacteristic(this.api.hap.Characteristic.SerialNumber, hbDeviceId)
          .setCharacteristic(this.api.hap.Characteristic.Manufacturer, device.brandName)
          .setCharacteristic(
            this.api.hap.Characteristic.Model,
            device.productModel + ' (' + device.extra.model + ')'
          )
          .setCharacteristic(
            this.api.hap.Characteristic.FirmwareRevision,
            device.params.fwVersion || PLUGIN.version
          )
          .setCharacteristic(this.api.hap.Characteristic.Identify, true)

        // A function for when the identify button is pressed in HomeKit apps
        accessory.on('identify', (paired, callback) => {
          callback()
          this.log('[%s] %s.', accessory.displayName, this.lang.identify)
        })
      }

      // Add helpful context values to the accessory
      accessory.context = {
        ...{
          hbDeviceId,
          eweDeviceId: device.deviceid,
          eweUIID: device.extra.uiid,
          eweModel: device.productModel,
          eweApiKey: device.apikey,
          switchNumber,
          channelCount
        },
        ...extraContext
      }

      // Register the accessory if it hasn't been hidden by the user
      if (!hidden) {
        this.api.registerPlatformAccessories(PLUGIN.name, PLUGIN.alias, [accessory])
        this.log('[%s] %s.', newDeviceName, this.lang.devAdd)
      }

      // Return the new accessory
      return accessory
    } catch (err) {
      // Catch any errors during add
      const eText = this.funcs.parseError(err)
      this.log.warn('[%s] %s %s.', newDeviceName, this.lang.devNotAdd, eText)
      return false
    }
  }

  configureAccessory (accessory) {
    // Function is called to retrieve each accessory from the cache on startup
    try {
      if (!this.log) {
        return
      }

      // Set the correct firmware version if we can
      if (this.api && accessory.context.firmware) {
        accessory.getService(this.api.hap.Service.AccessoryInformation)
          .updateCharacteristic(
            this.api.hap.Characteristic.FirmwareRevision,
            accessory.context.firmware
          )
      }

      // Add the configured accessory to our global map
      this.devicesInHB.set(accessory.UUID, accessory)
    } catch (err) {
      // Catch any errors during retrieve
      const eText = this.funcs.parseError(err)
      this.log.warn('[%s] %s %s.', accessory.displayName, this.lang.devNotConf, eText)
    }
  }

  removeAccessory (accessory) {
    try {
      // Remove an accessory from Homebridge
      this.api.unregisterPlatformAccessories(PLUGIN.name, PLUGIN.alias, [accessory])
      this.devicesInHB.delete(accessory.UUID)
      this.log('[%s] %s.', accessory.displayName, this.lang.devRemove)
    } catch (err) {
      // Catch any errors during remove
      const eText = this.funcs.parseError(err)
      this.log.warn('[%s] %s %s.', accessory.displayName, this.lang.devNotRemove, eText)
    }
  }

  async sendDeviceUpdate (accessory, params, useWS) {
    // Add to a queue so multiple updates are at least 500ms apart
    return await this.queue.add(async () => {
    // Log the update being sent
      if (this.config.debug) {
        this.log(
          '[%s] %s %s.',
          accessory.displayName,
          this.lang.updSend,
          JSON.stringify(params)
        )
      }

      // Set up the payload to send via LAN/WS
      const payload = {
        apikey: accessory.context.eweApiKey,
        deviceid: accessory.context.eweDeviceId,
        params
      }

      // Check if we can send via LAN otherwise send via WS
      const res = useWS
        ? this.lang.wsRequired
        : !this.lanClient
          ? this.lang.lanDisabled
          : !this.consts.devices.lanOut.includes(accessory.context.eweUIID)
            ? this.lang.lanNotSup
            : await this.lanClient.sendUpdate(payload)

      // Revert to WS if LAN mode not possible for whatever reason
      if (res !== 'ok') {
        // Check to see if the device is online
        if (this.wsClient) {
          // Log the revert if appropriate
          if (this.config.debug) {
            this.log('[%s] %s %s.', accessory.displayName, this.lang.revertWS, res)
          }

          // Attempt the update
          if (accessory.context.reachableWAN) {
            // Device is online via WS so send the update
            await this.wsClient.sendUpdate(payload)
          } else {
            // Device appears to be offline
            throw new Error(this.lang.unreachable)
          }
        } else {
          // Device isn't online via WS so report the error back
          const eText = [this.lang.lanDisabled, this.lang.lanNotSup].includes(res)
            ? res
            : this.lang.unreachable + ' [' + res + ']'
          throw new Error(eText)
        }
      }
    })
  }

  async receiveDeviceUpdate (device) {
    const deviceId = device.deviceid
    let accessory
    let reachableChange = false

    // Find our accessory for which the updates relates to
    const uuid1 = this.api.hap.uuid.generate(deviceId + 'SWX')
    const uuid2 = this.api.hap.uuid.generate(deviceId + 'SW0')
    if ((accessory = this.devicesInHB.get(uuid1) || this.devicesInHB.get(uuid2))) {
      if (this.config.debug) {
        this.log(
          '[%s] %s %s.',
          accessory.displayName,
          this.lang.updRec,
          JSON.stringify(device.params)
        )
      }
      if (device.params.updateSource === 'WS') {
        // The update is from WS so update the WS online/offline status
        if (device.params.online !== accessory.context.reachableWAN) {
          accessory.context.reachableWAN = device.params.online
          this.api.updatePlatformAccessories(PLUGIN.name, PLUGIN.alias, [accessory])
          this.devicesInHB.set(accessory.UUID, accessory)

          // Flag this true to update the sub accessories later
          reachableChange = true

          // Log the new reachability of the device
          const status = accessory.context.reachableWAN
            ? this.lang.repOnline
            : this.lang.repOffline
          this.log('[%s] %s %s.', accessory.displayName, status, this.lang.viaWS)

          // Mark the online/offline status of certain devices
          if (this.consts.devices.markStatus.includes(accessory.context.eweUIID)) {
            accessory.control.markStatus(device.params.online)
          }

          // Try and request an update through WS if the device has come back online
          if (accessory.context.reachableWAN && this.wsClient) {
            try {
              this.wsClient.requestUpdate(accessory)
            } catch (err) {
              // Suppress any errors here
            }
          }
        }
      }
      if (device.params.updateSource === 'LAN' && !accessory.context.reachableLAN) {
        // The update is from LAN so it must be online
        accessory.context.reachableLAN = true
        this.api.updatePlatformAccessories(PLUGIN.name, PLUGIN.alias, [accessory])
        this.devicesInHB.set(accessory.UUID, accessory)

        // Flag this true to update the sub accessories later
        reachableChange = true

        // Log the new reachability of the device
        this.log(
          '[%s] %s %s.',
          accessory.displayName,
          this.lang.repOnline,
          this.lang.viaLAN
        )

        // Try and request an update through WS if the device has come back online
        if (accessory.context.reachableWAN && this.wsClient) {
          try {
            this.wsClient.requestUpdate(accessory)
          } catch (err) {
            // Suppress any errors here
          }
        }
      }

      // Update this new online/offline status for all switches of multi channel devices
      if (reachableChange && accessory.context.hbDeviceId.substr(-1) !== 'X') {
        // Loop through to see which channels are in HB
        for (let i = 1; i <= accessory.context.channelCount; i++) {
          const uuid = this.api.hap.uuid.generate(deviceId + 'SW' + i)
          if (this.devicesInHB.has(uuid)) {
            // Find the sub accessory
            const subAccessory = this.devicesInHB.get(uuid)

            // Update the WAN status
            subAccessory.context.reachableWAN = device.params.online

            // Update the LAN status
            if (device.params.updateSource === 'LAN') {
              subAccessory.context.reachableLAN = true
            }

            // Save the sub accessory updates to the platform
            this.api.updatePlatformAccessories(PLUGIN.name, PLUGIN.alias, [subAccessory])
            this.devicesInHB.set(subAccessory.UUID, subAccessory)
          }
        }
      }
      try {
        // Update the accessory with the new data
        if (accessory.control && accessory.control.externalUpdate) {
          accessory.control.externalUpdate(device.params)
        }
      } catch (err) {
        const eText = this.funcs.parseError(err)
        this.log.warn('[%s] %s %s.', accessory.displayName, this.lang.devNotRf, eText)
      }
    } else {
      // The device does not exist in HB so let's try to add it
      try {
        // Don't continue if the user has hidden this device
        if (this.config.ignoredDevices.includes(deviceId)) {
          return
        }

        // Log the update if debug is set to true
        if (this.config.debug) {
          this.log(
            '[%s] %s %s.',
            deviceId,
            this.lang.recNew,
            JSON.stringify(device.params)
          )
        }

        // Obtain full device information from the HTTP API
        const newDevice = await this.httpClient.getDevice(deviceId)

        // Initialise the device in HB
        this.initialiseDevice(newDevice)

        // Add the device to the LAN client map
        if (this.lanClient && this.consts.devices.lanIn.includes(newDevice.extra.uiid)) {
          this.lanClient.addDeviceToMap(newDevice)
        }
      } catch (err) {
        // Automatically adding the new device failed for some reason
        const eText = this.funcs.parseError(err)
        this.log.warn('[%s] %s %s.', deviceId, this.lang.devNewNotAdd, eText)
      }
    }
  }

  async deviceUpdateError (accessory, err, requestRefresh) {
    // Log the error
    const eText = this.funcs.parseError(err)
    this.log.warn('[%s] %s %s.', accessory.displayName, this.lang.devNotUpd, eText)

    // We only request a device refresh on failed internal updates
    if (requestRefresh && accessory.context.reachableWAN && this.wsClient) {
      try {
        await this.wsClient.requestUpdate(accessory)
      } catch (err) {
        // Suppress any errors at this point
      }
    }
  }
}

// Export the plugin to Homebridge
module.exports = hb => hb.registerPlatform(PLUGIN.alias, eWeLinkPlatform)
