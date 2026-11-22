export class Root {
  execute() {}
  configure() { this.dynamic = true; }
}
export class Middle extends Root { execute() {} }
