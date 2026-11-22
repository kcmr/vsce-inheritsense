import { Root } from './root.js';
class Middle extends Root {}
const Factory = parent => class extends Middle { factoryMethod() {} };
class Subject extends Factory(Object) { inspect() {} }
