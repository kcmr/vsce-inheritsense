import { ConfigurableComponent } from "../base/configurable-component.js";

export const SampleComponent = (superClass = class {}) => {
  return class extends ConfigurableComponent(superClass) {
    snapshot() {
      return {
        summary: this.summary,
        pending: this.isPending,
        onEvent: this.handleEvent
      };
    }

    get summary() {
      return this.isEnabled ? "enabled" : "disabled";
    }

    start() {
      this._dispatch({ type: "ready", payload: {} });
      this.loadResource();
      return this._resource ?? this._taskState;
    }
  };
};
