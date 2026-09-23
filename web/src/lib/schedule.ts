import type { Lesson, Period } from './types';

export const WEEKDAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

const PALETTE = ['#c45c26', '#2f6f4e', '#3d5a80', '#8a5a44', '#6b4c9a', '#9a3d4a', '#3f6f8a', '#a16207'];

export function subjectColor(name: string) {
	let hash = 0;
	for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
	return PALETTE[hash % PALETTE.length];
}

export function jsWeekday(date = new Date()) {
	return (date.getDay() + 6) % 7;
}

export function formatMin(min: number) {
	const hours = Math.floor(min / 60);
	const minutes = min % 60;
	return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function parseTime(value: string) {
	const [hours, minutes] = value.split(':').map(Number);
	if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
	return hours * 60 + minutes;
}

export function formatWhen(iso: string | null) {
	if (!iso) return '';
	const date = new Date(iso);
	return new Intl.DateTimeFormat('de-DE', {
		weekday: 'short',
		day: 'numeric',
		month: 'short',
		hour: '2-digit',
		minute: '2-digit'
	}).format(date);
}

export type Occurrence = { lesson: Lesson; at: Date };

export function upcoming(lessons: Lesson[], from = new Date(), days = 14, subject?: string): Occurrence[] {
	const list: Occurrence[] = [];
	const start = new Date(from);
	start.setHours(0, 0, 0, 0);
	const needle = subject?.trim().toLowerCase();

	for (let i = 0; i < days; i++) {
		const day = new Date(start);
		day.setDate(start.getDate() + i);
		const weekday = jsWeekday(day);
		for (const lesson of lessons) {
			if (needle && lesson.subject.trim().toLowerCase() !== needle) continue;
			if (lesson.weekday !== weekday) continue;
			const at = new Date(day);
			at.setHours(Math.floor(lesson.startMin / 60), lesson.startMin % 60, 0, 0);
			if (at.getTime() > from.getTime()) list.push({ lesson, at });
		}
	}

	return list.sort((a, b) => a.at.getTime() - b.at.getTime());
}

export function nowMinutes(date = new Date()) {
	return date.getHours() * 60 + date.getMinutes();
}

export function currentLesson(lessons: Lesson[], from = new Date()) {
	const weekday = jsWeekday(from);
	const min = nowMinutes(from);
	return (
		lessons.find((lesson) => lesson.weekday === weekday && lesson.startMin <= min && min < lesson.endMin) ?? null
	);
}

export function nextLesson(lessons: Lesson[], from = new Date(), subject?: string) {
	return upcoming(lessons, from, 21, subject)[0] ?? null;
}

export function remindNextWeek(from = new Date(), lesson?: Lesson | null) {
	const at = new Date(from);
	at.setDate(at.getDate() + 7);
	if (lesson) at.setHours(Math.floor(lesson.startMin / 60), lesson.startMin % 60, 0, 0);
	else at.setHours(16, 0, 0, 0);
	return at;
}

export function parsePeriods(raw: unknown): Period[] {
	if (Array.isArray(raw)) return raw.filter(isPeriod);
	if (typeof raw !== 'string' || !raw.trim()) return [];
	try {
		const parsed = JSON.parse(raw) as unknown;
		return Array.isArray(parsed) ? parsed.filter(isPeriod) : [];
	} catch {
		return [];
	}
}

function isPeriod(value: unknown): value is Period {
	if (!value || typeof value !== 'object') return false;
	const item = value as Period;
	return typeof item.label === 'string' && Number.isFinite(item.startMin) && Number.isFinite(item.endMin);
}

export function spanPeriods(periods: Period[], index: number, double: boolean) {
	const first = periods[index];
	const last = double ? periods[index + 1] : first;
	if (!first || !last) return null;
	return { startMin: first.startMin, endMin: last.endMin };
}

export function daysLeft(iso: string | null | undefined) {
	if (!iso) return null;
	const ms = new Date(iso).getTime() - Date.now();
	return Math.max(0, Math.ceil(ms / 86_400_000));
}
