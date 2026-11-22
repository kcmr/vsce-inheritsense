import { install } from './install.js';
class Root {
  constructor() { this.own = true; install(this); }
  configure() { this.dynamic = true; }
}
class Middle extends Root {}
class Subject extends Middle { inspect() {} }
