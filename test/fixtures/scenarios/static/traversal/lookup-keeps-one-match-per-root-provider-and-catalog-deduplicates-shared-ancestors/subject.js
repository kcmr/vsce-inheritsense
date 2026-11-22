import { Outer, Inner } from './providers.js';
class Subject extends Outer(Inner) { execute() {} inspect() {} }
