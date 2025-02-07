/* jshint -W014, -W033, esversion: 9 */
/* eslint-disable new-cap */
'use strict'

module.exports = {
  defaultConfig: {
    name: 'eWeLink',
    username: '',
    password: '',
    encodedPassword: false,
    mode: 'auto',
    disableDeviceLogging: false,
    debug: false,
    debugFakegato: false,
    disablePlugin: false,
    singleDevices: [],
    multiDevices: [],
    outletDevices: [],
    lightDevices: [],
    thDevices: [],
    fanDevices: [],
    sensorDevices: [],
    groups: [],
    bridgeSensors: [],
    ignoredDevices: [],
    platform: 'eWeLink'
  },

  defaultValues: {
    inUsePowerThreshold: 0,
    lowBattThreshold: 25,
    sensorTimeLength: 60,
    sensorTimeDifference: 120,
    offset: 0,
    minTarget: 10,
    maxTarget: 30,
    operationTime: 100,
    operationTimeDown: 100,
    mode: 'auto',
    bulbModel: 'bulbB02FA60',
    brightnessStep: 1,
    adaptiveLightingShift: 0
  },

  minValues: {
    inUsePowerThreshold: 0,
    lowBattThreshold: 5,
    sensorTimeLength: 1,
    sensorTimeDifference: 10,
    minTarget: 0,
    maxTarget: 1,
    operationTime: 20,
    operationTimeDown: 20,
    brightnessStep: 1,
    adaptiveLightingShift: 0
  },

  appId: 'oeVkj2lYFGnJu5XUtWisfW4utiN4u9Mq',

  appSecret: '6Nz4n0xA8s8qdxQf2GqurZj2Fs55FUvM',

  httpRetryCodes: ['ENOTFOUND', 'ETIMEDOUT', 'EAI_AGAIN'],

  allowed: {
    singleDevices: [
      'deviceId', 'label', 'showAsOutlet', 'ipAddress', 'overrideDisabledLogging'
    ],
    multiDevices: [
      'deviceId', 'label', 'showAsOutlet', 'inUsePowerThreshold', 'hideChannels',
      'ipAddress', 'overrideDisabledLogging'
    ],
    outletDevices: [
      'deviceId', 'label', 'showAsSwitch', 'inUsePowerThreshold', 'ipAddress',
      'overrideDisabledLogging'
    ],
    lightDevices: [
      'deviceId', 'label', 'bulbModel', 'brightnessStep', 'adaptiveLightingShift',
      'ipAddress', 'overrideDisabledLogging'
    ],
    thDevices: [
      'deviceId', 'label', 'hideSwitch', 'offset', 'minTarget', 'maxTarget',
      'overrideDisabledLogging'
    ],
    fanDevices: ['deviceId', 'label', 'hideLight', 'overrideDisabledLogging'],
    sensorDevices: [
      'deviceId', 'lowBattThreshold', 'hideLongDouble', 'scaleBattery',
      'sensorTimeDifference', 'overrideDisabledLogging'
    ],
    groupTypes: [
      'blind', 'door', 'garage', 'garage_two', 'garage_four', 'garage_eachen', 'lock',
      'sensor_leak', 'switch_valve', 'tap', 'tap_two', 'thermostat', 'valve', 'valve_two',
      'valve_four', 'window'
    ],
    modes: ['auto', 'wan', 'lan'],
    obstructs: ['garage', 'garage_eachen'],
    setups: ['oneSwitch', 'twoSwitch'],
    sensors: ['water', 'smoke', 'co', 'co2', 'contact', 'occupancy', 'motion'],
    bulbModel: ['bulbB02BA60', 'bulbB02FA60', 'bulbB02FST64']
  },

  devices: {
    lanIn: [1, 2, 3, 4, 5, 6, 7, 8, 9, 14, 15, 28, 32, 44, 77, 78, 103, 104, 126],
    lanOut: [1, 2, 3, 4, 5, 6, 7, 8, 9, 14, 28, 32, 44, 77, 78, 126],
    markStatus: [59, 103, 104, 1009, 1256, 1257, 1258],
    singleSwitch: [1, 5, 6, 14, 24, 27],
    doubleSwitch: [126],
    multiSwitch: [2, 3, 4, 7, 8, 9, 29, 30, 31, 41, 82, 83, 84],
    singleSwitchOutlet: ['Sonoff Pow', 'S20', 'S26', 'S26R1', 'S55', 'S55R1'],
    lightDimmer: [36, 44, 57],
    lightRGB: [22],
    lightCCT: [103],
    lightRGBCCT: [59, 104],
    curtain: [11],
    sensorContact: [102],
    sensorAmbient: [15],
    sensorTempHumi: [18],
    thermostat: [127],
    fan: [34],
    humidifier: [19],
    diffuser: [25],
    outlet: [32],
    outletSCM: [77, 78, 81, 107],
    camera: [87],
    rfBridge: [28, 98],
    zbBridge: [66],
    zbSwitchStateless: [1000],
    zbSwitchSingle: [1009, 1256],
    zbLightDimmer: [1257],
    zbLightCCT: [1258],
    zbSensorAmbient: [1770],
    zbSensorMotion: [2026],
    zbSensorContact: [3026],
    cannotSupport: [0, 65, 118, 119, 120, 121]
  },

  paramsToKeep: [
    'battery', 'bright', 'brightness', 'channel', 'channel0', 'cmd', 'color', 'colorB',
    'colorG', 'colorR', 'current', 'currentHumidity', 'currentTemperature',
    'currLocation', 'humidity', 'key', 'lightbright', 'lightswitch', 'lightRcolor',
    'lightGcolor', 'lightBcolor', 'location', 'lock', 'ltype', 'mainSwitch', 'mode',
    'motion', 'online', 'power', 'rfChl', 'rfList', 'rfTrig', 'sensorType', 'setclose',
    'state', 'switch', 'switches', 'targetTemp', 'temperature', 'tempScale', 'trigTime',
    'type', 'voltage', 'white', 'workMode', 'workState', 'zyx_mode'
  ],

  supportedDevices: {
    1: 1, // "SOCKET" (MINI, BASIC, S20, S26, S55, RF, RF_R2)
    2: 2, // "SOCKET_2"
    3: 3, // "SOCKET_3"
    4: 4, // "SOCKET_4"
    5: 1, // "SOCKET_POWER" (Sonoff Pow)
    6: 1, // "SWITCH" (T1 1C, TX1C, G1)
    7: 2, // "SWITCH_2" (T1 2C, TX2C)
    8: 3, // "SWITCH_3" (T1 3C, TX3C)
    9: 4, // "SWITCH_4"
    11: 1, // "CURTAIN" (King Q4 Cover)
    14: 1, // "SWITCH_CHANGE" (Sonoff SV)
    15: 1, // "THERMOSTAT" (TH10, TH16)
    18: 1, // "SENSORS_CENTER" (Sonoff SC)
    19: 1, // "HUMIDIFIER"
    22: 1, // "RGB_BALL_LIGHT" (B1, B1_R2)
    24: 1, // "GSM_SOCKET"
    25: 1, // "AROMATHERAPY" (Diffuser, Komeito 1515-X)
    27: 1, // "GSM_UNLIMIT_SOCKET"
    28: 1, // "RF_BRIDGE" (RFBridge, RF_Bridge)
    29: 2, // "GSM_SOCKET_2"
    30: 3, // "GSM_SOCKET_3"
    31: 4, // "GSM_SOCKET_4"
    32: 1, // "POWER_DETECTION_SOCKET" (Pow_R2, S31, IW101)
    34: 4, // "FAN_LIGHT" (iFan02, iFan)
    36: 1, // "SINGLE_CHANNEL_DIMMER_SWITCH" (KING-M4)
    41: 4, // "CUN_YOU_DOOR"
    44: 1, // "SNOFF_LIGHT" (D1)
    57: 1, // "MONOCHROMATIC_BALL_LIGHT" (mosquito killer)
    59: 1, // "MUSIC_LIGHT_BELT" (L1)
    66: 1, // "ZIGBEE_MAIN_DEVICE"
    77: 4, // "SINGLE_SOCKET_MULTIPLE" (1 socket device using data structure of four)
    78: 4, // "SINGLE_SWITCH_MULTIPLE" (1 switch device using data structure of four
    81: 1, // "GSM_SOCKET_NO_FLOW" (1 socket device using data structure of four)
    82: 2, // "GSM_SOCKET_2_NO_FLOW"
    83: 3, // "GSM_SOCKET_3_NO_FLOW"
    84: 4, // "GSM_SOCKET_4_NO_FLOW"
    87: 1, // "EWELINK_IOT_CAMERA" (GK-200MP2B)
    98: 1, // "DOORBELL_RFBRIDGE"
    102: 1, // "DOOR_MAGNETIC" (OPL-DMA, DW2)
    103: 1, // "WOTEWODE_TEM_LIGHT" (B02-F)
    104: 1, // "WOTEWODE_RGB_TEM_LIGHT"
    107: 1, // "GSM_SOCKET_NO_FLOW"
    126: 2, // "DUALR3"
    127: 1, // "GTTA127"
    1000: 1, // "zigbee_ON_OFF_SWITCH_1000" (button device)
    1009: 1, // "" (Some sort of single switch device)
    1256: 1, // "ZIGBEE_SINGLE_SWITCH"
    1257: 1, // "ZigbeeWhiteLight"
    1258: 1,
    1770: 1, // "ZIGBEE_TEMPERATURE_SENSOR"
    2026: 1, // "ZIGBEE_MOBILE_SENSOR"
    3026: 1 // "ZIGBEE_DOOR_AND_WINDOW_SENSOR"
  },

  cannotSupportDevices: {
    0: 0, // Placeholder for devices reported without a uiid (should be a never case)
    65: 0, // "CustomCamera" (eWeLink Camera App)
    118: 0, // "2.4G-1C" (eWeLink 2.4G Remote)
    119: 0, // "2.4G-2C" (eWeLink 2.4G Remote)
    120: 0, // "2.4G-3C" (eWeLink 2.4G Remote)
    121: 0 // "2.4G-6C" (eWeLink 2.4G Remote)
  },

  yetToSupportDevices: {
    10: 0, // "OSPF"
    12: 0, // "EW-RE"
    13: 0, // "FIREPLACE"
    16: 0, // "COLD_WARM_LED"
    17: 0, // "THREE_GEAR_FAN"
    23: 0, // "NEST_THERMOSTAT"
    26: 0, // "RuiMiTeWenKongQi"
    33: 0, // "LIGHT_BELT",
    35: 0, // "EZVIZ_CAMERA",
    38: 0, // "HOME_KIT_BRIDGE",
    40: 0, // "FUJIN_OPS"
    42: 0, // "SMART_BEDSIDE_AND_NEW_RGB_BALL_LIGHT"
    43: 0, // "?"
    45: 0, // "DOWN_CEILING_LIGHT"
    46: 0, // "AIR_CLEANER"
    49: 0, // "MACHINE_BED"
    51: 0, // "COLD_WARM_DESK_LIGHT"
    52: 0, // "DOUBLE_COLOR_DEMO_LIGHT"
    53: 0, // "ELECTRIC_FAN_WITH_LAMP"
    55: 0, // "SWEEPING_ROBOT"
    56: 0, // "RGB_BALL_LIGHT_4"
    60: 0, // "NEW_HUMIDIFIER"
    61: 0, // "KAI_WEI_ROUTER"
    62: 0, // "MEARICAMERA"
    64: 0, // "HeatingTable"
    67: 0, // "RollingDoor"
    68: 0, // "KOOCHUWAH"
    69: 0, // "ATMOSPHERE_LAMP"
    76: 0, // "YI_GE_ER_LAMP"
    79: 0, // "CHRISTMAS_LIGHT"
    80: 0, // "HANYUAN_AIR_CONDITION"
    86: 0, // "CLEAR_BOOT"
    88: 0, // "YK_INFRARED"
    89: 0, // "SMART_OPEN_MACHINE"
    90: 0, // "GSM_RFBridge"
    91: 0, // "ROLLING_DOOR_91"
    93: 0, // "HTHD_AIR_CLEANER"
    94: 0, // "YIAN_ELECTRIC_PROTECT"
    109: 0, // "YK_INFRARED_2"
    1001: 0, // "BLADELESS_FAN"
    1002: 0, // "NEW_HUMIDIFIER"
    1003: 0, // "WARM_AIR_BLOWER"
    2256: 2, // "ZIGBEE_SWITCH_2"
    3256: 3, // "ZIGBEE_SWITCH_3"
    4026: 1, // "ZIGBEE_WATER_SENSOR"
    4256: 4 // "ZIGBEE_SWITCH_4"
  }
}
