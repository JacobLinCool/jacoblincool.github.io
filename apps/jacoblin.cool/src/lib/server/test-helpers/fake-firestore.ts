type DocData = Record<string, unknown>;

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const isImmediateChild = (collectionPath: string, docPath: string) => {
    if (!docPath.startsWith(`${collectionPath}/`)) {
        return false;
    }

    const remainder = docPath.slice(collectionPath.length + 1);
    return Boolean(remainder) && !remainder.includes('/');
};

const extractDocId = (path: string) => path.split('/').at(-1) ?? path;

class FakeDocSnapshot {
    constructor(
        readonly id: string,
        private readonly value: DocData | null
    ) {}

    get exists() {
        return this.value !== null;
    }

    data() {
        return this.value ? clone(this.value) : undefined;
    }
}

class FakeCollectionSnapshot {
    constructor(readonly docs: FakeDocSnapshot[]) {}
}

const compareOrderedValues = (
    left: string | number | boolean | null | undefined,
    right: string | number | boolean | null | undefined,
    direction: 'asc' | 'desc'
) => {
    if (left === right) {
        return 0;
    }

    if (left == null) {
        return direction === 'asc' ? -1 : 1;
    }

    if (right == null) {
        return direction === 'asc' ? 1 : -1;
    }

    const ascending = Number(left > right) - Number(left < right);
    return direction === 'asc' ? ascending : -ascending;
};

class FakeCollectionRef {
    private orderField: string | null = null;
    private orderDirection: 'asc' | 'desc' = 'asc';
    private maxItems: number | null = null;

    constructor(
        private readonly store: Map<string, DocData>,
        private readonly path: string,
        private readonly idFactory: () => string
    ) {}

    doc(id?: string) {
        const nextId = id ?? this.idFactory();
        return new FakeDocRef(this.store, `${this.path}/${nextId}`);
    }

    orderBy(field: string, direction: 'asc' | 'desc' = 'asc') {
        this.orderField = field;
        this.orderDirection = direction;
        return this;
    }

    limit(count: number) {
        this.maxItems = count;
        return this;
    }

    async get() {
        const snapshots = [...this.store.entries()]
            .filter(([path]) => isImmediateChild(this.path, path))
            .map(([path, value]) => new FakeDocSnapshot(extractDocId(path), value));

        const ordered = this.orderField
            ? snapshots.sort((left, right) => {
                  const leftValue = left.data()?.[this.orderField ?? ''];
                  const rightValue = right.data()?.[this.orderField ?? ''];

                  if (leftValue === rightValue) {
                      return 0;
                  }

                  if (leftValue === undefined) {
                      return this.orderDirection === 'asc' ? -1 : 1;
                  }

                  if (rightValue === undefined) {
                      return this.orderDirection === 'asc' ? 1 : -1;
                  }

                  return compareOrderedValues(
                      leftValue as string | number | boolean | null | undefined,
                      rightValue as string | number | boolean | null | undefined,
                      this.orderDirection
                  );
              })
            : snapshots;

        return new FakeCollectionSnapshot(
            this.maxItems === null ? ordered : ordered.slice(0, this.maxItems)
        );
    }
}

class FakeDocRef {
    constructor(
        private readonly store: Map<string, DocData>,
        readonly path: string
    ) {}

    get id() {
        return extractDocId(this.path);
    }

    async get() {
        return new FakeDocSnapshot(this.id, this.store.get(this.path) ?? null);
    }

    async set(value: DocData, options?: { merge?: boolean }) {
        const existing = this.store.get(this.path) ?? {};
        this.store.set(this.path, options?.merge ? { ...existing, ...clone(value) } : clone(value));
    }
}

class FakeTransaction {
    private readonly staged = new Map<string, DocData>();

    constructor(private readonly store: Map<string, DocData>) {}

    async get(ref: FakeDocRef) {
        return new FakeDocSnapshot(
            ref.id,
            this.staged.get(ref.path) ?? this.store.get(ref.path) ?? null
        );
    }

    set(ref: FakeDocRef, value: DocData, options?: { merge?: boolean }) {
        const existing = this.staged.get(ref.path) ?? this.store.get(ref.path) ?? {};
        this.staged.set(ref.path, options?.merge ? { ...existing, ...clone(value) } : clone(value));
    }

    commit() {
        for (const [path, value] of this.staged.entries()) {
            this.store.set(path, clone(value));
        }
    }
}

export class FakeFirestore {
    private readonly store = new Map<string, DocData>();
    private nextId = 0;

    doc(path: string) {
        return new FakeDocRef(this.store, path);
    }

    collection(path: string) {
        return new FakeCollectionRef(this.store, path, () => {
            this.nextId += 1;
            return `fake-${this.nextId}`;
        });
    }

    async runTransaction<R>(updateFn: (transaction: FakeTransaction) => Promise<R>) {
        const transaction = new FakeTransaction(this.store);
        const result = await updateFn(transaction);
        transaction.commit();
        return result;
    }

    dump(pathPrefix?: string) {
        const entries = [...this.store.entries()].filter(([path]) =>
            pathPrefix ? path.startsWith(pathPrefix) : true
        );

        return new Map(entries.map(([path, value]) => [path, clone(value)]));
    }
}
