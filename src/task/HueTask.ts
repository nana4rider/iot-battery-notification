import config from 'config';
import { api } from 'node-hue-api';
import { env } from 'process';
import { BaseTask, BatteryInfo } from './BaseTask';

const batteryInfo: BatteryInfo = { type: 'aaa', quantity: 2 };

export class HueTask extends BaseTask {
  constructor() {
    super('Phillips Hue');
  }

  async process(finish: () => void): Promise<void> {
    const hueApi = await api.createLocal(config.get('hue.host')).connect(env.HUE_CLIENT_ID);
    const sensors = await hueApi.sensors.getAll();

    for (const sensor of sensors) {
      const config = sensor.getConfig();
      const battery: number | undefined = config.battery;
      if (battery != undefined) {
        this.addStatus({
          id: String(sensor.id),
          deviceName: sensor.name,
          value: battery,
          info: batteryInfo
        });
      }
    }

    finish();
  }
}
