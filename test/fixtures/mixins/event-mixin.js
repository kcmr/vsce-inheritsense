import { dedupingMixin } from "../utils/deduping-mixin.js";

export const eventMixin = dedupingMixin((superClass) => {
  return class extends superClass {
    /**
     * Records the most recently received event.
     * @param {Event} event - Incoming event.
     */
    handleEvent(event) {
      this._lastEvent = event;
    }
  };
});
