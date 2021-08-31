import config from 'config';
import { FlicBatteryStatusListener, FlicClient } from 'fliclib-js';
import * as log4js from 'log4js';
import { BaseTask, BatteryInfo } from './BaseTask';

const logger = log4js.getLogger();

type FlicConfig = {
  hosts: string[]
  deviceNames: Record<string, string>
};

const batteryInfoMap: Record<number, BatteryInfo> = {
  1: { type: 'cr2016', quantity: 1 },
  2: { type: 'cr2032', quantity: 1 }
};

export class FlicTask extends BaseTask {
  constructor() {
    super('Flic');
  }

  async process(finish: () => void): Promise<void> {
    const flicConfig: FlicConfig = config.get('flic');
    const deviceNames = flicConfig.deviceNames;

    let finishClientCount = 0;
    const finishClient = () => {
      if (++finishClientCount === flicConfig.hosts.length) {
        finish();
      }
    };

    for (const host of flicConfig.hosts) {
      let finishButtonCount = 0;
      const client = new FlicClient(host);

      client.once('ready', () => client.getInfo(info => {
        const buttons = info.bdAddrOfVerifiedButtons;
        if (!buttons.length) {
          finishClient();
          return;
        }

        for (const macAddress of buttons) {
          client.getButtonInfo(macAddress, (bdAddr: string, uuid: string, color: string,
            serialNumber: string, flicVersion: number, firmwareVersion: number) => {

            const fsl = new FlicBatteryStatusListener(macAddress);
            client.addBatteryStatusListener(fsl);

            fsl.on('batteryStatus', (batteryPercentage: number, timestamp: Date) => {
              logger.debug('Flic Timestamp:', serialNumber, timestamp);

              this.addStatus({
                id: macAddress,
                deviceName: deviceNames[serialNumber] ?? serialNumber,
                value: batteryPercentage,
                info: this.getBatteryInfo(flicVersion)
              });

              client.removeBatteryStatusListener(fsl);

              if (++finishButtonCount === buttons.length) {
                finishClient();
              }
            });
          });
        }
      }));
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
