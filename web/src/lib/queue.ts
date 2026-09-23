import type { LocalFile } from './types';

const DB_NAME = 'hausi-queue';
const STORE = 'ops';

type Base = { id: string; at?: number };

export type QueueOp = Base &
	(
		| { kind: 'task'; rowId?: string; payload: Record<string, unknown>; files: LocalFile[]; permissions?: string[] }
		| { kind: 'create'; table: string; rowId: string; data: Record<string, unknown>; permissions?: string[] }
		| { kind: 'update'; table: string; rowId: string; data: Record<string, unknown> }
		| { kind: 'delete'; table: string; rowId: string }
		| { kind: 'note'; payload: Record<string, unknown> }
		| { kind: 'patch-task'; taskId: string; data: Record<string, unknown> }
		| { kind: 'delete-task'; taskId: string; fileIds?: string[] }
		| { kind: 'delete-note'; noteId: string }
	);

function openDb() {
	return new Promise<IDBDatabase>((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, 1);
		request.onupgradeneeded = () => {
			request.result.createObjectStore(STORE, { keyPath: 'id' });
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T> | void) {
	const db = await openDb();
	try {
		return await new Promise<T | undefined>((resolve, reject) => {
			const tx = db.transaction(STORE, mode);
			const request = work(tx.objectStore(STORE));
			tx.oncomplete = () => resolve(request ? request.result : undefined);
			tx.onerror = () => reject(tx.error);
		});
	} finally {
		db.close();
	}
}

export async function enqueue(op: QueueOp) {
	await run('readwrite', (store) => {
		store.put({ ...op, at: op.at ?? Date.now() });
	});
}

export async function listQueue(): Promise<QueueOp[]> {
	const ops = ((await run('readonly', (store) => store.getAll())) ?? []) as QueueOp[];
	return ops.sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
}

export async function removeQueued(id: string) {
	await run('readwrite', (store) => {
		store.delete(id);
	});
}

export async function clearQueue() {
	await run('readwrite', (store) => {
		store.clear();
	});
}

export async function queueCount() {
	return ((await run('readonly', (store) => store.count())) ?? 0) as number;
}
