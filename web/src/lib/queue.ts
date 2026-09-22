import type { LocalFile } from './types';

const DB_NAME = 'hausi-queue';
const STORE = 'ops';

export type QueueOp =
	| { id: string; kind: 'task'; payload: Record<string, unknown>; files: LocalFile[] }
	| { id: string; kind: 'note'; payload: Record<string, unknown> }
	| { id: string; kind: 'patch-task'; taskId: string; data: Record<string, unknown> }
	| { id: string; kind: 'delete-task'; taskId: string }
	| { id: string; kind: 'delete-note'; noteId: string };

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

export async function enqueue(op: QueueOp) {
	const db = await openDb();
	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction(STORE, 'readwrite');
		tx.objectStore(STORE).put(op);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
	db.close();
}

export async function listQueue(): Promise<QueueOp[]> {
	const db = await openDb();
	const ops = await new Promise<QueueOp[]>((resolve, reject) => {
		const tx = db.transaction(STORE, 'readonly');
		const request = tx.objectStore(STORE).getAll();
		request.onsuccess = () => resolve(request.result as QueueOp[]);
		request.onerror = () => reject(request.error);
	});
	db.close();
	return ops;
}

export async function removeQueued(id: string) {
	const db = await openDb();
	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction(STORE, 'readwrite');
		tx.objectStore(STORE).delete(id);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
	db.close();
}

export async function queueCount() {
	const ops = await listQueue();
	return ops.length;
}
