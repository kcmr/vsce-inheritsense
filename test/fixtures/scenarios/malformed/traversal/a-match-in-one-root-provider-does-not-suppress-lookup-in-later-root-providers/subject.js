import { Broken } from './broken.js';
const Ready = parent => class { execute() {} };
class Subject extends Ready(Broken) { inspect() {} }
