export const SCHEDULERS = [
	{
		kind: "ladder" as const,
		title: "Ladder",
		hint: "Fixed intervals that you set yourself",
	},
	{
		kind: "fsrs" as const,
		title: "FSRS",
		hint: "The interval follows how well you actually remember",
	},
];

export const RETENTIONS = [0.8, 0.85, 0.9, 0.95];

export const MIN_DESIRED_RETENTION = 0.7;
export const MAX_DESIRED_RETENTION = 0.98;
