import { dedupingMixin } from "../utils/deduping-mixin.js";
import { eventMixin } from "../mixins/event-mixin.js";
import { ComponentCore } from "../core/component-core.js";

export const ConfigurableComponent = dedupingMixin((superClass) => {
  return class extends eventMixin(ComponentCore(superClass)) {
    static get properties() {
      return {
        isEnabled: { type: Boolean },
        needsRefresh: { type: Boolean }
      };
    }

    constructor() {
      super();
      this._taskState = {
        pending: false
      };
      this.needsRefresh = false;
    }

    async configure() {
      this._label = "example";
    }

    loadResource() {
      return Promise.resolve({ key: "sample-resource" }).then((resource) => {
        this._resource = resource;
        return resource;
      });
    }

    _dispatch(message) {
      return this.emitSignal(message.type, message.payload);
    }

    get isPending() {
      return this._taskState.pending;
    }
  };
});
