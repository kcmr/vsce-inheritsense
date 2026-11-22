class Example {
    constructor() {
      this.own = true;
      const arrow = () => { this.lexical = true; };
      function unrelated() { this.foreignFunction = true; }
      class Nested { constructor() { this.foreignClass = true; } }
    }
  }
