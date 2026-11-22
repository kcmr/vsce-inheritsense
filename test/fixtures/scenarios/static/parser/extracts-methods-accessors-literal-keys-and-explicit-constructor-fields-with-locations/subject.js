export class Example {
    count = 0;
    constructor() { this.ready = true; }
    run() {}
    get value() { return this.count; }
    set value(next) { this.count = next; }
    "literalMethod"() {}
    later() { this.dynamic = true; }
  }
