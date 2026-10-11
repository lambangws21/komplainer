import { FieldValue } from 'firebase-admin/firestore';
export function fakeFirestore() {
  const data = new Map();
  const copy = (value) => value == null ? value : structuredClone(value);
  const snapshot = (path) => ({ id: path.split('/').at(-1), exists: data.has(path), data: () => copy(data.get(path)) });
  const ref = (path) => ({ path, id: path.split('/').at(-1), get: async () => snapshot(path), collection: (name) => collection(`${path}/${name}`) });
  const collection = (path, filters = [], sort = null, max = Infinity) => ({
    doc: (id) => ref(`${path}/${id}`),
    where: (field, operator, value) => collection(path, [...filters, [field, operator, value]], sort, max),
    orderBy: (field, direction = 'asc') => collection(path, filters, [field, direction], max),
    limit: (count) => collection(path, filters, sort, count),
    get: async () => {
      let docs = [...data.keys()].filter((key) => key.startsWith(path + '/') && key.split('/').length === path.split('/').length + 1).map(snapshot).filter((doc) => filters.every(([field, operator, value]) => operator === '==' ? doc.data()[field] === value : doc.data()[field] <= value));
      if (sort) docs.sort((a,b) => (a.data()[sort[0]] < b.data()[sort[0]] ? -1 : 1) * (sort[1] === 'desc' ? -1 : 1));
      docs = docs.slice(0,max); return { docs };
    },
  });
  return { data, collection,
    runTransaction: async (run) => {
      const writes = [];
      const result = await run({ get: async (item) => snapshot(item.path), set: (item,value) => writes.push(['set',item.path,value]), create: (item,value) => writes.push(['create',item.path,value]), update: (item,value) => writes.push(['update',item.path,value]) });
      for (const [operation,path] of writes) if (operation === 'create' && data.has(path) || operation === 'update' && !data.has(path)) throw Error('Invalid transaction write');
      for (const [operation,path,value] of writes) {
        if (operation === 'update') {
          const merged = copy(data.get(path));
          for (const [key,item] of Object.entries(value)) { if (item?.isEqual?.(FieldValue.delete())) delete merged[key]; else merged[key] = copy(item); }
          data.set(path,merged);
        } else data.set(path,copy(value));
      }
      return result;
    },
  };
}
