class Root { execute() {} }
class Middle extends Root {}
class Subject extends Middle {
  inspect() {
    this.execute;
  }
}
