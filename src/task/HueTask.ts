import config from 'config';
import { api } from 'node-hue-api';
import { BaseTask, BatteryInfo } from './BaseTask';

const batteryInfoMap: Record<string, BatteryInfo> = {
  'ZLLPresence': {type: 'aaa', quantity: 2},
  'ZLLSwitch': {type: 'cr2032', quantity: 1}
};

export class HueTask extends BaseTask {
  constructor() {
    super('Phillips Hue');
  }

  async process(finish: () => void): Promise<void> {
    const hueApi = await api.createLocal(config.get('hue.host')).connect(config.get('hue.clientId'));
    const sensors = await hueApi.sensors.getAll();

    for (const sensor of sensors) {
      const config = sensor.getConfig();
      const battery: number | undefined = config.battery;
      if (battery !== undefined) {
        const id = sensor.type + '_' + sensor.id;
        this.addStatus({
          id,
          deviceName: sensor.name,
          value: battery,
          info: batteryInfoMap[sensor.type] ?? HueTask.UNKNOWN_BATTERY_STATUS
        });
      }
    }

    finish();
  }
}
