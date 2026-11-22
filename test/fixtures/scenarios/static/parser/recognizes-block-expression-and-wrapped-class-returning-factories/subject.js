
    const ExpressionFactory = parent => class extends parent { first() {} };
    function BlockFactory(parent) { return class extends parent { second() {} }; }
    export const WrappedFactory = wrapper(parent => class extends parent { third() {} });
