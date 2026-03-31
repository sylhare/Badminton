import type { StatAnomaly } from './statisticalAnomalyChecker';

let current: StatAnomaly[] = [];
const listeners: Array<() => void> = [];

export const setAnomalies = (anomalies: StatAnomaly[]): void => {
  current = anomalies;
  listeners.forEach(l => l());
};

export const getAnomalies = (): StatAnomaly[] => current;

export const onAnomaliesChange = (listener: () => void): () => void => {
  listeners.push(listener);
  return () => listeners.splice(listeners.indexOf(listener), 1);
};
