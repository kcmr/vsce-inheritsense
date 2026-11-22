import { Root } from '../first/root.js';
export class Subject extends Root {
  own() {}
  inspect() {
    this.execute();
    this.own();
    this.dynamic;
  }
}
