function install(target) { target.injected = true; target.execute = () => {}; }
class Root { execute() {} injected() {} inherited() {} }
class Middle extends Root { constructor() { install(this); } execute() {} }
class Subject extends Middle { inspect() {} }
