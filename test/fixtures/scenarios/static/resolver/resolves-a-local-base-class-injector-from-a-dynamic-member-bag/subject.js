const members = { execute: () => {}, ready: true };
function install(target) {
  Object.entries(members).forEach(([key, value]) => { target[key] = value; });
}
class Base { constructor() { install(this); } }
class Subject extends Base { inspect() { this.execute(); } }
