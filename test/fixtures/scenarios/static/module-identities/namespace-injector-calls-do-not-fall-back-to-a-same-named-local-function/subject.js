import * as ns from './root.js';
function install(target) { target.foreign = true; }
class Base { constructor() { ns.install(this); ns.sub.install(this); } }
class Subject extends Base { inspect() {} }
