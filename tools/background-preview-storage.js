// Preview iframe only: preserve the real save while reading its initial contents.
// Loaded synchronously before main.js, including its initial storage.load().
(() => {
  const initial = window.localStorage;
  const values = new Map();
  for (let i = 0; i < initial.length; i++) {
    const key = initial.key(i);
    values.set(key, initial.getItem(key));
  }
  const memory = {
    getItem: key => values.get(String(key)) ?? null,
    setItem: (key,value) => values.set(String(key),String(value)),
    removeItem: key => values.delete(String(key)),
    clear: () => values.clear(),
    key: index => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  };
  Object.defineProperty(window, 'localStorage', {value:memory});
})();
