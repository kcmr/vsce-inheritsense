export const Base = class {
  constructor() {
    this.initialized = true;
    const arrow = () => { this.lexical = true; };
    function other() { this.foreign = true; }
  }
  execute() {}
  get value() { return 1; }
  set value(next) {}
  'literal-method'() {}
  'literal-field' = true;
  #privateField = true;
  [dynamicKey]() {}
  static get properties() { return { declared: {}, 'literal-property': {} }; }
  configure() { this.dynamic = true; }
  static setup() { this.staticAssigned = true; }
 };
