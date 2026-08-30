import type { ResolvedQuizSettings } from "@recall/contracts";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { RetentionChoice } from "@/features/settings/ui/components/RetentionChoice";
import { SchedulerChoice } from "@/features/settings/ui/components/SchedulerChoice";
import { SaveState } from "@/shared/ui/components/SaveState";
import type { SaveState as State } from "@/shared/ui/components/SaveState.types";

interface Props {
	readonly resolved: ResolvedQuizSettings;
	readonly state: State;
	readonly scoped?: boolean;
	readonly onChange: (change: Record<string, unknown>) => void;
}

const source: Record<string, string> = {
	set: "власні налаштування набору",
	global: "спільні налаштування",
	default: "типові значення",
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
					Діють {source[resolved.source] ?? resolved.source}
				</p>
				<SaveState state={state} />
			</div>

			{scoped ? (
				<Card>
					<CardContent className="pt-2">
						<Switch
							label="Власні налаштування для цього набору"
							hint={
								own
									? "Зміни нижче стосуються лише цього набору"
									: "Зараз набір використовує спільні налаштування"
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
						label="Перемішувати варіанти"
						hint="Порядок відповідей змінюється щоразу"
						checked={settings.shuffleOptions}
						onChange={(shuffleOptions) => onChange({ shuffleOptions })}
					/>
					<Switch
						label="Перемішувати питання"
						hint="Набір іде не по порядку"
						checked={settings.shuffleQuestions}
						onChange={(shuffleQuestions) => onChange({ shuffleQuestions })}
					/>
					<Switch
						label="Режим іспиту"
						hint="Відповіді показуються тільки в кінці"
						checked={settings.examMode}
						onChange={(examMode) => onChange({ examMode })}
					/>
				</CardContent>
			</Card>

			<Card>
				<CardContent className="space-y-4 pt-5">
					<div className="space-y-2">
						<span className="block text-sm font-medium">
							Як рахувати наступне повторення
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
								Цільове запам'ятовування
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
								Яку частку питань ви хочете пам'ятати на момент повторення. Вище
								— повторень більше, інтервали коротші.
							</p>
						</div>
					) : (
						<div className="space-y-1.5">
							<label htmlFor="intervals" className="block text-sm font-medium">
								Інтервали повторення, дні
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
								Через скільки днів питання повертається після кожної правильної
								відповіді.
							</p>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
