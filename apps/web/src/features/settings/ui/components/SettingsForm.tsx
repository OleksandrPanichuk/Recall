import type { ResolvedQuizSettings } from "@recall/contracts";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { RetentionChoice } from "@/features/settings/ui/components/RetentionChoice";
import { SchedulerChoice } from "@/features/settings/ui/components/SchedulerChoice";
import type { SaveState as State } from "@/shared/lib/save-state.types";
import { SaveState } from "@/shared/ui/components/SaveState";

interface Props {
	readonly resolved: ResolvedQuizSettings;
	readonly state: State;
	readonly scoped?: boolean;
	readonly onChange: (change: Record<string, unknown>) => void;
}

const source: Record<string, string> = {
	set: "this quiz's own settings",
	global: "the shared settings",
	default: "the defaults",
};

export function SettingsForm({
	resolved,
	state,
	scoped = false,
	onChange,
}: Props) {
	const { settings } = resolved;
	const own = resolved.source === "set";
	const [intervals, setIntervals] = useState(
		settings.repetition.intervalsDays.join(", "),
	);

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between gap-3">
				<p className="text-sm text-muted-foreground">
					Using {source[resolved.source] ?? resolved.source}
				</p>
				<SaveState state={state} />
			</div>

			{scoped ? (
				<Card>
					<CardContent className="pt-2">
						<Switch
							label="Give this quiz its own settings"
							hint={
								own
									? "Changes below apply to this quiz only"
									: "This quiz currently follows the shared settings"
							}
							checked={own}
							onChange={(wanted) =>
								onChange(
									wanted
										? {
												shuffleOptions: settings.shuffleOptions,
												shuffleQuestions: settings.shuffleQuestions,
												examMode: settings.examMode,
												repetition: settings.repetition,
											}
										: { inheritGlobal: true },
								)
							}
						/>
					</CardContent>
				</Card>
			) : null}

			<Card>
				<CardContent className="divide-y divide-border pt-2">
					<Switch
						label="Shuffle options"
						hint="The order of answers changes every time"
						checked={settings.shuffleOptions}
						onChange={(shuffleOptions) => onChange({ shuffleOptions })}
					/>
					<Switch
						label="Shuffle questions"
						hint="The quiz runs out of order"
						checked={settings.shuffleQuestions}
						onChange={(shuffleQuestions) => onChange({ shuffleQuestions })}
					/>
					<Switch
						label="Exam mode"
						hint="Answers are shown only at the end"
						checked={settings.examMode}
						onChange={(examMode) => onChange({ examMode })}
					/>
				</CardContent>
			</Card>

			<Card>
				<CardContent className="space-y-4 pt-5">
					<div className="space-y-2">
						<span className="block text-sm font-medium">
							How the next review is worked out
						</span>
						<SchedulerChoice
							value={settings.repetition.scheduler}
							onChange={(scheduler) =>
								onChange({
									repetition: { ...settings.repetition, scheduler },
								})
							}
						/>
					</div>

					{settings.repetition.scheduler === "fsrs" ? (
						<div className="space-y-2">
							<span className="block text-sm font-medium">
								Target retention
							</span>
							<RetentionChoice
								value={settings.repetition.desiredRetention}
								onChange={(desiredRetention) =>
									onChange({
										repetition: { ...settings.repetition, desiredRetention },
									})
								}
							/>
							<p className="text-xs text-muted-foreground">
								How much you want to remember by the time a question comes back.
								Higher means more reviews and shorter intervals.
							</p>
						</div>
					) : (
						<div className="space-y-1.5">
							<label htmlFor="intervals" className="block text-sm font-medium">
								Review intervals, days
							</label>
							<Input
								id="intervals"
								value={intervals}
								onChange={(event) => setIntervals(event.target.value)}
								onBlur={() => {
									const days = intervals
										.split(",")
										.map((part) => Number.parseInt(part.trim(), 10))
										.filter((day) => Number.isFinite(day) && day > 0);

									if (days.length === 0) {
										setIntervals(settings.repetition.intervalsDays.join(", "));

										return;
									}

									setIntervals(days.join(", "));
									onChange({
										repetition: { ...settings.repetition, intervalsDays: days },
									});
								}}
							/>
							<p className="text-xs text-muted-foreground">
								How many days until a question comes back after each correct
								answer.
							</p>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
