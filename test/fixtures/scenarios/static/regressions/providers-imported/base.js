import { Root } from './root.js';
class Middle extends Root {}
export const Factory = parent => class extends Middle { factoryMethod() {} };
