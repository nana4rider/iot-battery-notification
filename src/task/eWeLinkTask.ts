import config from 'config';
import ewelink from 'ewelink-api';
import * as log4js from 'log4js';
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
    const client = new ewelink({
      email: config.get('ewelink.email'),
      password: config.get('ewelink.password')
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
