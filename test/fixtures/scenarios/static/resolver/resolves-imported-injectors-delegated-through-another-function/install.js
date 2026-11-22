function add(target) { target.execute = () => {}; }
export function install(target) { add(target); }
