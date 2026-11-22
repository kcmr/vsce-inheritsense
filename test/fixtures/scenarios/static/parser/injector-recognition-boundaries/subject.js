const bag = { run: () => {}, enabled: true, ['ignored']: false };
bag[dynamicKey] = () => {};
bag['literal'] = true;
bag[123] = false;
bag.skipped += 1;
function install(target) {
  target.direct = () => {};
  target['literalDirect'] = 1;
  target[dynamicKey] = 2;
  target.compound += 1;
  other.foreign = 1;
  Object.entries(bag).forEach(([key, value]) => { target[key] += value; });
  Object['entries'](bag).forEach(([key, value]) => { target[key] = value; });
  Object.entries(bag)['forEach'](([key, value]) => { target[key] = value; });
  Object.entries(bag).forEach((entry) => { target[entry] = true; });
  Object.entries(bag).forEach(([key, value]) => target[key] = value);
}
function rejected(target) {
  Object.values(bag).forEach(([key, value]) => { target[key] = value; });
  Object.entries(bag).forEach(([key, value]) => { other[key] = value; });
  Object.entries(bag).forEach(([key, value]) => { target.other = value; });
  Object.entries(bag).forEach(([key, value]) => { target['key'] = value; });
  Object['entries'](bag).forEach(([key, value]) => { target[key] = value; });
  Object.entries(bag)['forEach'](([key, value]) => { target[key] = value; });
  Object.entries(bag).forEach((entry) => { target[entry] = true; });
  Object.entries(bag).forEach(([key, value]) => target[key] = value);
}
