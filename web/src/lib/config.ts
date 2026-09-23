export const APPWRITE_ENDPOINT = 'https://fra.cloud.appwrite.io/v1';
export const APPWRITE_PROJECT = '6ab2cde600019a5f8815';
export const DATABASE_ID = 'hausi';
export const BUCKET_ID = 'attachments';

export const TABLES = {
	profiles: 'profiles',
	timetables: 'timetables',
	lessons: 'lessons',
	tasks: 'tasks',
	notes: 'notes',
	shares: 'shares'
} as const;

/** Aufgaben ohne Premium bleiben zwei Monate. */
export const FREE_RETENTION_DAYS = 60;
