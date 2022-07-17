import axios from 'axios';
import config from 'config';
import * as log4js from 'log4js';
import { BaseTask, BatteryInfo } from './BaseTask';


const Switchbot = require('node-switchbot');
const logger = log4js.getLogger();

type Device = StandardDevice | CurtainDevice;

interface StandardDevice {
  deviceId: string,
  deviceName: string,
  deviceType: 'Hub Mini' | 'Meter' | 'Bot',
  enableCloudService: boolean,
  hubDeviceId: string
}

interface CurtainDevice {
  deviceId: string,
  deviceName: string,
  deviceType: 'Curtain',
  enableCloudService: boolean,
  hubDeviceId: string
  curtainDevicesIds: string[]
  calibrate: boolean,
  group: boolean,
  master: boolean
}

const batteryInfoMap: Record<string, BatteryInfo> = {
  'Bot': { type: 'cr2', quantity: 1 },
  'Meter': { type: 'aaa', quantity: 2 },
  'Curtain': { type: 'internal', quantity: 0 }
};

export class SwitchBotTask extends BaseTask {
  private switchbot;

  constructor() {
    super('SwitchBot');
    this.switchbot = new Switchbot();
  }

  onTimeout() {
    this.switchbot.stopScan();
  }

  async process(finish: () => void): Promise<void> {
    const response = await axios.get('https://api.switch-bot.com/v1.0/devices', {
      headers: { 'Authorization': config.get('switchbot.token') }
    });

    const allDevices = response.data.body.deviceList as Device[];
    const devices = allDevices.filter(device => batteryInfoMap[device.deviceType]);

    devices.forEach(device => {
      if (device.deviceType !== 'Curtain' || !device.master) return;
      const subDeviceIds = device.curtainDevicesIds.filter(id => id !== device.deviceId);
      devices.forEach(subDevice => {
        if (subDeviceIds.includes(subDevice.deviceId)) {
          subDevice.deviceName = device.deviceName + '(Sub)';
        }
      });
      device.deviceName += '(Master)';
    });

    await this.switchbot.startScan();

    this.switchbot.onadvertisement = (deviceInfo: any) => {
      const deviceId = deviceInfo.address.replace(/:/g, '').toUpperCase();
      for (const [index, device] of devices.entries()) {
        if (device.deviceId !== deviceId
          || deviceInfo.serviceData.battery == undefined) continue;
        this.addStatus({
          id: device.deviceId,
          deviceName: device.deviceName,
          value: deviceInfo.serviceData.battery,
          info: this.getBatteryInfo(device.deviceType)
        });
        // 複数回検出されるため、1度検出したデバイスは除外する
        devices.splice(index, 1);
        break;
      }

      if (!devices.length) {
        this.switchbot.stopScan();
        finish();
      }
    };
  }

  private getBatteryInfo(deviceType: string): BatteryInfo {
    if (batteryInfoMap[deviceType]) {
      return batteryInfoMap[deviceType];
    }

    logger.warn('[Switchbot] Unknown deviceType:', deviceType);

    return SwitchBotTask.UNKNOWN_BATTERY_STATUS;
  }
}
