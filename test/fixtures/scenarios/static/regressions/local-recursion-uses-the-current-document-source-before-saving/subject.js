class Root { savedMember() {} }
class Middle extends Root {}
class Subject extends Middle {
  inspect() {
    this.savedMember;
  }
}
