import { Broken } from './broken.js';
class Ready { execute() {} }
export class Base extends Ready(Broken) {}
