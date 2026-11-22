const bag = { run: () => {}, 'label': true };
function install(target) {
  target.run = () => {};
  target.run = () => {};
  Object.entries(bag).forEach(([key, value]) => { target[key] = value; });
}
class Base {
  constructor() { this.run = () => {}; ns.install(this); ns.install(this); }
  run() {}
  run() {}
  get value() { return 1; }
  set value(next) {}
}
