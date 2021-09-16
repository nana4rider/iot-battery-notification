import config from 'config';
import * as log4js from 'log4js';
import { env } from 'process';
import * as log4jconfig from './config/log4js';
import { eWeLinkTask } from './task/eWeLinkTask';
import { FlicTask } from './task/FlicTask';
import { HueTask } from './task/HueTask';
import { SwitchBotTask } from './task/SwitchBotTask';

if (!env.NODE_ENV) throw new Error('NODE_ENV is empty.');

function exit(data: any, code = 0) {
  console.log(JSON.stringify({ ...data, code }));
  process.exit(code);
}

// log4js
log4js.configure(log4jconfig.configures[env.NODE_ENV]);
const logger = log4js.getLogger();

process.on('unhandledRejection', (reason, p) => {
  const message = `Unhandled Rejection at: ${p} reason: ${reason}`;
  logger.error(message);
  exit({ content: message }, 1);
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
      if (a.id > b.id) return -1;
      if (a.id < b.id) return 1;
      return 0;
    });

    for (const status of sortedStatusList) {
      if (status.value < min && status.value >= 0) min = status.value;
      const batteryName = batteryNames[status.info.type] ?? status.info.type;
      message += `${status.deviceName} ${status.value}% (${batteryName} ${status.info.quantity}個)\n`;
    }
  }

  const threshold: number = config.get('warningThreshold');
  if (min <= threshold) {
    message = `@everyone バッテリー残量が${threshold}%を切っている端末があります\n` + message;
  }

  exit({ content: message });
});
