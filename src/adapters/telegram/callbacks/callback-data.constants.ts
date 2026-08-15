export const CallbackAction = {
	Menu: "m",
	Sets: "l",
	StartSet: "s",
	Resume: "r",
	Answer: "a",
	Toggle: "t",
	Finish: "f",
	Statistics: "x",
	StatisticsFor: "y",
	Browse: "b",
	Unavailable: "u",
} as const;
export type CallbackAction =
	(typeof CallbackAction)[keyof typeof CallbackAction];
