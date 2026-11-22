const bag = { bagMethod: () => {}, 'bag-field': true };
bag.extra = () => {};
function direct(target) { target.injected = () => {}; target['quotedInjected'] = true; }
function install(target) {
  direct(target);
  Object.entries(bag).forEach(([key, value]) => { target[key] = value; });
}
function repeat(target) { target.twice = () => {}; target.twice = () => {}; }
const Factory = Base => class extends Base { factoryMethod() {} };
class Root {
  execute() {}
  async asyncMethod() {}
  get value() { return 1; } set value(next) {}
  'literal-method'() {}
  'literal-field' = true;
  \u0065scaped() {}
  constructor() { this.assigned = true; install(this); repeat(this); }
  static get properties() { return { declared: Boolean, 'declared-literal': String }; }
  update() { this.dynamic = true; }
}
class Subject extends Factory(Root) {
  constructor() { super(); }
  inspect() {
    this.execute(); this.asyncMethod(); this.value; this.escaped(); this.assigned;
    this.injected(); this.factoryMethod();
  }
}
class First { same() {} } class Second { same() {} }
class Multiple extends combine(First, Second) { inspect() { this.same(); } }
class Direct extends Root {
  inspectDirect() {
    this.execute(); this.asyncMethod(); this.value; this.escaped(); this.assigned;
    this['literal-method'](); this['literal-field'];
  }
}
