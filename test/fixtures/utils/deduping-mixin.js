export function dedupingMixin(factory) {
  return (superClass) => factory(superClass);
}
