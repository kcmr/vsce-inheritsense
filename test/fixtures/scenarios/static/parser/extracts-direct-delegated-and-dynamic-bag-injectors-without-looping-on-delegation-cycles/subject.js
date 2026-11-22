
    const members = { execute: () => {}, enabled: true };
    members.label = "sample";
    function copy(target) {
      Object.entries(members).forEach(([key, value]) => { target[key] = value; });
    }
    function direct(target) { target.reset = () => {}; copy(target); }
    function install(target) { direct(target); cycle(target); }
    function cycle(target) { install(target); }
    class Example { constructor() { install(this); install(this); } }
