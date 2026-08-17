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
	Reveal: "v",
	Repetitions: "p",
	AttemptDetail: "d",
	StartDue: "e",
	Settings: "n",
	SettingsFor: "o",
	SettingsEdit: "j",
} as const;
export const SettingsChange = {
	Preset: "p",
	CeilingUp: "c",
	CeilingDown: "C",
	RepetitionsUp: "r",
	RepetitionsDown: "R",
	ShuffleOptions: "s",
	ShuffleQuestions: "S",
	InheritGlobal: "g",
	Nothing: "n",
} as const;
export type SettingsChange =
	(typeof SettingsChange)[keyof typeof SettingsChange];

export type CallbackAction =
	(typeof CallbackAction)[keyof typeof CallbackAction];
