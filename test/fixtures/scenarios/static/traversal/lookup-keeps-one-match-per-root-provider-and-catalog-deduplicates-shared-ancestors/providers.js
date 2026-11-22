class Shared { execute() {} sharedOnly() {} }
export const Outer = parent => class extends Shared { execute() {} };
export class Inner extends Shared { execute() {} }
