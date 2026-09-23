/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `hausi-${version}`;
const SHELL = '/index.html';
const ASSETS = [...build, ...files];

sw.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);
			await cache.addAll(ASSETS);
			try {
				await cache.add(SHELL);
			} catch {
				/* Shell wird beim ersten Seitenaufruf nachgeladen */
			}
			await sw.skipWaiting();
		})()
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) {
				if (key !== CACHE) await caches.delete(key);
			}
			await sw.clients.claim();
		})()
	);
});

sw.addEventListener('fetch', (event) => {
	const request = event.request;
	if (request.method !== 'GET') return;
	const url = new URL(request.url);
	if (url.origin !== sw.location.origin) return;

	if (request.mode === 'navigate') {
		event.respondWith(
			(async () => {
				const cache = await caches.open(CACHE);
				try {
					const response = await fetch(request);
					if (response.ok) await cache.put(SHELL, response.clone());
					return response;
				} catch {
					return (await cache.match(SHELL)) ?? Response.error();
				}
			})()
		);
		return;
	}

	if (ASSETS.includes(url.pathname)) {
		event.respondWith(
			(async () => {
				const cache = await caches.open(CACHE);
				return (await cache.match(url.pathname)) ?? fetch(request);
			})()
		);
	}
});
