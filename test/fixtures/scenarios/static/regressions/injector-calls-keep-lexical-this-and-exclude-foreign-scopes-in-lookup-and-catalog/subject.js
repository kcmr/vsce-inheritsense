function own(target) { target.injected = true; }
function lexical(target) { target.arrowInjected = true; }
function key(target) { target.keyInjected = true; }
function foreign(target) { target.foreignInjected = true; }
class Base {
  constructor() {
    own(this);
    const arrow = () => { lexical(this); };
    function unrelated() { foreign(this); }
    const expression = function () { foreign(this); };
    const object = { [key(this)]() { foreign(this); } };
    class Nested { constructor() { foreign(this); } }
  }
}
class Subject extends Base { inspect() {} }
