import config from 'config';
import * as log4js from 'log4js';

const logger = log4js.getLogger();
const timeout: number = config.get('timeout');

type BatteryType = 'unknown' | 'internal' | 'aa' | 'aaa' | 'cr2' | 'cr2016' | 'cr2032';

type TaskResult = {
  type: string;
  results: BatteryStatus[];
};

type BatteryInfo = {
  type: BatteryType
  quantity: number;
}

type BatteryStatus = {
  id: string;
  deviceName: string;
  value: number;
  info: BatteryInfo;
};

abstract class BaseTask {
  private readonly results: BatteryStatus[] = [];
  protected static readonly UNKNOWN_BATTERY_STATUS: BatteryInfo = { type: 'unknown', quantity: 0 };

  constructor(protected readonly type: string) {
  }

  protected addStatus(batteryStatus: BatteryStatus): void {
    this.results.push(batteryStatus);
  }

  async execute(): Promise<TaskResult> {
    return new Promise<TaskResult>(async (resolve, reject) => {
      let timer: NodeJS.Timeout | undefined = undefined;
      const finish = () => {
        if (timer != undefined) clearTimeout(timer);
        resolve({ type: this.type, results: this.results });
      };

      try {
        timer = setTimeout(() => {
          try {
            logger.warn(this.type, 'is timeout.');
            this.onTimeout();

            if (this.results.length) {
              // 1件でも取得できた場合は通知する
              finish();
            } else {
              reject(new Error('Timeout Error'));
            }
          } catch (error) {
            logger.error(this.type, 'onTimeout error: ', error);
            reject(error);
          }
        }, timeout);

        await this.process(() => {
          logger.info(this.type, 'is completed.');
          finish();
        });
      } catch (error) {
        logger.error(this.type, 'process error: ', error);
        if (timer != undefined) clearTimeout(timer);
        reject(error);
      }
    });
  }

  abstract process(finish: () => void): Promise<void> | void;

  protected onTimeout() {
  }
}

export { BaseTask, BatteryType, TaskResult, BatteryInfo, BatteryStatus };
