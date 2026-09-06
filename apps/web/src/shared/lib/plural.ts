export function counted(count: number, one: string, many = `${one}s`): string {
	return `${count} ${count === 1 ? one : many}`;
}

export const questions = (count: number): string => counted(count, "question");
export const quizzes = (count: number): string =>
	counted(count, "quiz", "quizzes");
export const pages = (count: number): string => counted(count, "page");
export const attempts = (count: number): string => counted(count, "attempt");
export const answers = (count: number): string => counted(count, "answer");
export const weeks = (count: number): string => counted(count, "week");
export const days = (count: number): string => counted(count, "day");
export const items = (count: number): string => counted(count, "item");
export const lapses = (count: number): string => counted(count, "lapse");
