export default async ({ req, res, error }) => {
	const endpoint = process.env.APPWRITE_FUNCTION_API_ENDPOINT;
	const project = process.env.APPWRITE_FUNCTION_PROJECT_ID;
	const key = req.headers['x-appwrite-key'];
	const userId = req.headers['x-appwrite-user-id'];
	if (!userId) return res.json({ message: 'Bitte zuerst anmelden.' }, 401);

	let code = '';
	try {
		code = String(JSON.parse(req.body || '{}').code || '').trim();
	} catch {
		code = '';
	}
	if (code.length < 4) return res.json({ message: 'Ungültiger Einladungslink.' }, 400);

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
		const data = text ? JSON.parse(text) : {};
		if (!response.ok) {
			const err = new Error(data.message || text || String(response.status));
			err.status = response.status;
			throw err;
		}
		return data;
	}

	const params = new URLSearchParams();
	params.append('queries[]', JSON.stringify({ method: 'equal', attribute: 'inviteCode', values: [code] }));
	params.append('queries[]', JSON.stringify({ method: 'limit', values: [1] }));

	try {
		const found = await api(`/tablesdb/hausi/tables/books/rows?${params}`);
		const book = found.rows?.[0];
		if (!book?.teamId || book.kind !== 'shared') {
			return res.json({ message: 'Dieses Buch gibt es nicht mehr.' }, 404);
		}
		try {
			await api(`/teams/${book.teamId}/memberships`, {
				method: 'POST',
				body: { membershipId: crypto.randomUUID().replaceAll('-', '').slice(0, 20), userId, roles: ['member'] }
			});
		} catch (cause) {
			if (cause.status !== 409) throw cause;
		}
		return res.json({ bookId: book.$id, name: book.name });
	} catch (cause) {
		error(String(cause));
		return res.json({ message: cause.message || 'Beitreten hat nicht geklappt.' }, cause.status && cause.status < 500 ? cause.status : 500);
	}
};
