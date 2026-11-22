class Example {
      configure() {
        this.own = true;
        const arrow = (value = (this.arrowDefault = true)) => () => { this.lexical = value; };
        function unrelated(value = (this.foreignDefault = true)) {
          const nestedArrow = () => { this.foreignArrow = value; };
        }
        const expression = function () { this.foreignExpression = true; };
        const object = {
          [this.objectKey = "method"]() { this.foreignMethod = true; },
          get value() { this.foreignGetter = true; },
          set value(next) { this.foreignSetter = next; },
          arrow: () => { this.objectArrow = true; }
        };
        class Nested extends (this.heritage = Parent) {
          [this.classKey = "method"]() { this.foreignClass = true; }
          static [this.staticKey = "field"] = (this.foreignStatic = true);
          field = (() => { this.foreignInitializer = true; })();
          static { this.foreignBlock = true; }
        }
        const ClassExpression = class { constructor() { this.foreignClassExpression = true; } };
      }
    }
