import { Root as Parent, PublicInstall as apply } from './root.js';
export class Base extends Parent {
  constructor() { apply(this); }
  execute() {}
  configure() { this.dynamic = true; }
  get value() { return 1; }
  set value(next) {}
}
