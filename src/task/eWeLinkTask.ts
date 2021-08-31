import ewelink from 'ewelink-api';
import * as log4js from 'log4js';
import { env } from 'process';
import { BaseTask, BatteryInfo } from './BaseTask';

const logger = log4js.getLogger();

const batteryInfoMap: Record<string, BatteryInfo> = {
  'ZIGBEE_DOOR_AND_WINDOW_SENSOR': { type: 'cr2032', quantity: 1 }
};

export class eWeLinkTask extends BaseTask {
  constructor() {
    super('eWeLink');
  }

  async process(finish: () => void): Promise<void> {
    if (!env.EWELINK_EMAIL || !env.EWELINK_PASSWORD) throw new Error('E-Mail or Password is empty.');

    const client = new ewelink({
      email: env.EWELINK_EMAIL,
      password: env.EWELINK_PASSWORD
    });

    const devices = await client.getDevices();

    for (const device of devices) {
      const params: any = device.params;
      if (params.battery) {
        this.addStatus({
          id: device.deviceid,
          deviceName: device.name,
          value: params.battery,
          info: this.getBatteryInfo(device.productModel)
        });
      }
    }

    finish();
  }

  private getBatteryInfo(productModel: string): BatteryInfo {
    if (batteryInfoMap[productModel]) {
      return batteryInfoMap[productModel];
    }

    logger.warn('[eWeLink] Unknown productModel:', productModel);

    return eWeLinkTask.UNKNOWN_BATTERY_STATUS;
  }
}
