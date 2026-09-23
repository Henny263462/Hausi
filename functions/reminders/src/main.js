export default async ({ req, res, log, error }) => {
	const endpoint = process.env.APPWRITE_FUNCTION_API_ENDPOINT;
	const project = process.env.APPWRITE_FUNCTION_PROJECT_ID;
	const key = req.headers['x-appwrite-key'];

	async function api(path, options = {}) {
		const response = await fetch(`${endpoint}${path}`, {
			method: options.method ?? 'GET',
			headers: {
				'content-type': 'application/json',
				'x-appwrite-project': project,
				'x-appwrite-key': key
			},
			body: options.body ? JSON.stringify(options.body) : undefined
		});
		const text = await response.text();
		if (!response.ok) throw new Error(`${response.status} ${text}`);
		return text ? JSON.parse(text) : {};
	}

	function query(list) {
		const params = new URLSearchParams();
		for (const item of list) params.append('queries[]', JSON.stringify(item));
		return params.toString();
	}

	const now = new Date().toISOString();
	let reminded = 0;
	let expired = 0;

	try {
		const due = await api(
			`/tablesdb/hausi/tables/tasks/rows?${query([
				{ method: 'equal', attribute: 'reminderSent', values: [false] },
				{ method: 'equal', attribute: 'done', values: [false] },
				{ method: 'lessThanEqual', attribute: 'remindAt', values: [now] },
				{ method: 'limit', values: [25] }
			])}`
		);

		for (const row of due.rows ?? []) {
			if (!row.remindAt) continue;
			try {
				const user = await api(`/users/${row.userId}`);
				const who = user.name ? ` ${user.name}` : '';
				await api('/messaging/messages/email', {
					method: 'POST',
					body: {
						messageId: crypto.randomUUID(),
						subject: `Erinnerung: ${row.title}`,
						html: true,
						users: [row.userId],
						content: `<p>Hallo${who},</p><p>deine Aufgabe <strong>${escapeHtml(row.title)}</strong>${
							row.subject ? ` in ${escapeHtml(row.subject)}` : ''
						} wartet.</p>${row.details ? `<p>${escapeHtml(row.details)}</p>` : ''}<p>Hausi</p>`
					}
				});
				await api(`/tablesdb/hausi/tables/tasks/rows/${row.$id}`, {
					method: 'PATCH',
					body: { data: { reminderSent: true } }
				});
				reminded += 1;
			} catch (cause) {
				error(String(cause));
			}
		}
	} catch (cause) {
		error(`Erinnerungen: ${cause}`);
	}

	try {
		const old = await api(
			`/tablesdb/hausi/tables/tasks/rows?${query([
				{ method: 'lessThanEqual', attribute: 'expiresAt', values: [now] },
				{ method: 'limit', values: [25] }
			])}`
		);
		for (const row of old.rows ?? []) {
			for (const fileId of row.fileIds ?? []) {
				try {
					await api(`/storage/buckets/attachments/files/${fileId}`, { method: 'DELETE' });
				} catch (cause) {
					log(String(cause));
				}
			}
			try {
				const linked = await api(
					`/tablesdb/hausi/tables/shares/rows?${query([
						{ method: 'equal', attribute: 'taskId', values: [row.$id] },
						{ method: 'limit', values: [5] }
					])}`
				);
				for (const share of linked.rows ?? []) {
					await api(`/tablesdb/hausi/tables/shares/rows/${share.$id}`, { method: 'DELETE' });
				}
			} catch (cause) {
				log(String(cause));
			}
			await api(`/tablesdb/hausi/tables/tasks/rows/${row.$id}`, { method: 'DELETE' });
			expired += 1;
		}
	} catch (cause) {
		error(`Ablauf: ${cause}`);
	}

	return res.json({ reminded, expired });
};

function escapeHtml(value) {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;');
}
