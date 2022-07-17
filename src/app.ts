import axios from 'axios';
import config from 'config';
import * as log4js from 'log4js';
import { exit } from 'process';
import * as log4jconfig from './config/log4js';
import { eWeLinkTask } from './task/eWeLinkTask';
import { FlicTask } from './task/FlicTask';
import { HueTask } from './task/HueTask';
import { SwitchBotTask } from './task/SwitchBotTask';

// log4js
log4js.configure(log4jconfig.configures[config.get('env') as string]);
const logger = log4js.getLogger();

process.on('unhandledRejection', (reason, p) => {
  logger.error('Unhandled Rejection at:', p, 'reason:', reason);
  exit(1);
});

const tasks = {
  'flic': FlicTask,
  'switchbot': SwitchBotTask,
  'ewelink': eWeLinkTask,
  'hue': HueTask
};

const isTask = (taskName: string): taskName is keyof typeof tasks => {
  return tasks.hasOwnProperty(taskName);
};

const targetTasks = [];
for (const taskName of config.get('useTasks') as string[]) {
  if (!isTask(taskName)) throw new Error('Undefined Task: ' + taskName);
  targetTasks.push(new tasks[taskName]().execute());
}

const batteryNames: Record<string, string> = config.get('batteryTypeNames');

void Promise.allSettled(targetTasks).then(async settledResults => {
  let message = '';
  let min = 100;
  for (const settledResult of settledResults) {
    if (settledResult.status === 'rejected') {
      continue;
    }

    const taskResult = settledResult.value;
    if (taskResult.results.length) {
      message += `---- ${taskResult.type} ----\n`;
    }

    const sortedStatusList = taskResult.results.sort((a, b) => {
      if (a.deviceName > b.deviceName) return -1;
      if (a.deviceName < b.deviceName) return 1;
      return 0;
    });

    for (const status of sortedStatusList) {
      if (status.value < min && status.value >= 0) min = status.value;
      const batteryName = batteryNames[status.info.type] ?? status.info.type;
      const qty =  status.info.quantity === 0 ? '' : ` ${status.info.quantity}個`;
      message += `${status.deviceName} ${status.value}% (${batteryName}${qty})\n`;
    }
  }

  const threshold: number = config.get('warningThreshold');
  if (min <= threshold) {
    const mention: string = config.get('webhook.mention');
    message = `${mention} バッテリー残量が${threshold}%を切っている端末があります\n` + message;
  }

  if (config.has('webhook.url')) {
    const contentKey: string = config.get('webhook.requestKey');
    const url: string = config.get('webhook.url');
    await axios.post(url, { [contentKey]: message });
  } else {
    console.log(message);
  }

  exit(0);
});
