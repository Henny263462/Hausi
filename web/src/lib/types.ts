export type RemindMode = 'none' | 'next_lesson' | 'next_week' | 'custom';

export type Profile = {
	$id: string;
	userId: string;
	name: string;
	premium: boolean;
	activeTimetableId: string;
	activeBookId: string;
};

export type Period = {
	label: string;
	startMin: number;
	endMin: number;
};

export type Timetable = {
	$id: string;
	userId: string;
	name: string;
	active: boolean;
	periods: Period[];
};

export type Lesson = {
	$id: string;
	userId: string;
	timetableId: string;
	subject: string;
	weekday: number;
	startMin: number;
	endMin: number;
	room: string;
	color: string;
};

export type Book = {
	$id: string;
	userId: string;
	name: string;
	kind: 'private' | 'shared';
	teamId: string;
	inviteCode: string;
};

export type Task = {
	$id: string;
	$createdAt: string;
	userId: string;
	bookId: string;
	title: string;
	details: string;
	subject: string;
	lessonId: string;
	timetableId: string;
	done: boolean;
	remindMode: RemindMode;
	remindAt: string | null;
	reminderSent: boolean;
	expiresAt: string | null;
	fileIds: string[];
	pending?: boolean;
};

export type Share = {
	$id: string;
	userId: string;
	taskId: string;
	kind: 'task' | 'note';
	title: string;
	details: string;
	subject: string;
	fileIds: string[];
};

export type Note = {
	$id: string;
	$createdAt: string;
	userId: string;
	bookId: string;
	title: string;
	body: string;
	subject: string;
	pending?: boolean;
};

export type CalEvent = {
	$id: string;
	userId: string;
	bookId: string;
	title: string;
	details: string;
	subject: string;
	startsAt: string;
	kind: 'exam' | 'event';
	pending?: boolean;
};

export type LocalFile = {
	name: string;
	type: string;
	buffer: ArrayBuffer;
};
