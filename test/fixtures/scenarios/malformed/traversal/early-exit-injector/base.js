import { Broken } from './broken.js';
function install(target) { target.execute = () => {}; }
export class Base { constructor() { install(this); Broken(this); } }
