import config from 'config';
import { FlicBatteryStatusListener, FlicClient } from 'fliclib-js';
import * as log4js from 'log4js';
import { BaseTask, BatteryInfo } from './BaseTask';

const logger = log4js.getLogger();

const batteryInfoMap: Record<number, BatteryInfo> = {
  1: { type: 'cr2016', quantity: 1 },
  2: { type: 'cr2032', quantity: 1 }
};

export class FlicTask extends BaseTask {
  private client;

  constructor() {
    super('Flic');
    this.client = new FlicClient(config.get('flic.host'));
  }

  private async getButtons() {
    return new Promise<string[]>(resolve => {
      this.client.once('ready', () => {
        this.client.getInfo(info => resolve(info.bdAddrOfVerifiedButtons));
      });
    });
  }

  async process(finish: () => void): Promise<void> {
    const buttons = await this.getButtons();
    const deviceNames: Record<string, string> = config.get('flic.deviceNames');

    let found = 0;
    for (const macAddress of buttons) {
      this.client.getButtonInfo(macAddress, (bdAddr: string, uuid: string, color: string,
        serialNumber: string, flicVersion: number, firmwareVersion: number) => {

        const fsl = new FlicBatteryStatusListener(macAddress);
        this.client.addBatteryStatusListener(fsl);
        fsl.on('batteryStatus', (batteryPercentage: number, timestamp: Date) => {
          logger.info('Flic Timestamp:', serialNumber, timestamp);

          this.addStatus({
            id: macAddress,
            deviceName: deviceNames[serialNumber] ?? serialNumber,
            value: batteryPercentage,
            info: this.getBatteryInfo(flicVersion)
          });
          this.client.removeBatteryStatusListener(fsl);
          if (++found >= buttons.length) {
            finish();
          }
        });
      });
    }
  }

  private getBatteryInfo(version: number): BatteryInfo {
    if (batteryInfoMap[version]) {
      return batteryInfoMap[version];
    }

    logger.warn('[Flic] Unknown version:', version);

    return FlicTask.UNKNOWN_BATTERY_STATUS;
  }
}
