export const SCHEDULERS = [
	{
		kind: "ladder" as const,
		title: "Сходинка",
		hint: "Фіксовані інтервали, які ви задаєте самі",
	},
	{
		kind: "fsrs" as const,
		title: "FSRS",
		hint: "Інтервал рахується з того, як ви насправді пам'ятаєте",
	},
];

export const RETENTIONS = [0.8, 0.85, 0.9, 0.95];

export const MIN_DESIRED_RETENTION = 0.7;
export const MAX_DESIRED_RETENTION = 0.98;
