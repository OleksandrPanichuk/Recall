import type { ResolvedQuizSettings } from "@recall/contracts";
import { useState } from "react";
import { SaveState } from "@/components/SaveState";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import type { SaveState as State } from "@/hooks/use-autosave";

export interface SettingsFormProps {
	readonly resolved: ResolvedQuizSettings;
	readonly state: State;
	readonly onChange: (change: Record<string, unknown>) => void;
}

const source: Record<string, string> = {
	set: "власні налаштування набору",
	global: "спільні налаштування",
	default: "типові значення",
};

export function SettingsForm({ resolved, state, onChange }: SettingsFormProps) {
	const { settings } = resolved;
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
				</CardContent>
			</Card>
		</div>
	);
}
