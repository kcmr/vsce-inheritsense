export const ComponentCore = (superClass) =>
  class extends superClass {
    emitSignal(type, payload) {
      return { type, payload };
    }
  };
