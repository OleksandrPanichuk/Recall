import { useState } from "react";
import { api, type QuizSettings } from "../client";
import { Card, Failure, Toggle } from "../shell";

export function SettingsPage({
	settings,
	source,
	onChanged,
}: {
	settings: QuizSettings;
	source: string;
	onChanged: () => void;
}) {
	const [intervals, setIntervals] = useState(
		settings.repetition.intervalsDays.join(", "),
	);
	const [maxInterval, setMaxInterval] = useState(
		String(settings.repetition.maxIntervalDays),
	);
	const [maxRepetitions, setMaxRepetitions] = useState(
		String(settings.repetition.maxRepetitions),
	);
	const [error, setError] = useState<string | undefined>();

	const guard = async (work: () => Promise<unknown>) => {
		setError(undefined);

		try {
			await work();
			onChanged();
		} catch (failure) {
			setError(failure instanceof Error ? failure.message : "Не вдалося");
		}
	};

	return (
		<div>
			<h2>
				Глобальні налаштування <span className="muted">· {source}</span>
			</h2>
			<Failure error={error} />

			<Card>
				<Toggle
					label="Перемішувати варіанти"
					checked={settings.shuffleOptions}
					onChange={(shuffleOptions) =>
						void guard(() => api.saveSettings({ shuffleOptions }))
					}
				/>
				<Toggle
					label="Перемішувати питання"
					checked={settings.shuffleQuestions}
					onChange={(shuffleQuestions) =>
						void guard(() => api.saveSettings({ shuffleQuestions }))
					}
				/>
				<Toggle
					label="Режим екзамену"
					checked={settings.examMode}
					onChange={(examMode) =>
						void guard(() => api.saveSettings({ examMode }))
					}
				/>
			</Card>

			<h3>Інтервальні повторення</h3>
			<Card>
				<label className="field">
					<span>Інтервали (днів, через кому)</span>
					<input
						value={intervals}
						onChange={(event) => setIntervals(event.target.value)}
					/>
				</label>
				<div className="row">
					<label className="field">
						<span>Максимальний інтервал</span>
						<input
							value={maxInterval}
							onChange={(event) => setMaxInterval(event.target.value)}
						/>
					</label>
					<label className="field">
						<span>Максимум повторень</span>
						<input
							value={maxRepetitions}
							onChange={(event) => setMaxRepetitions(event.target.value)}
						/>
					</label>
				</div>
				<button
					type="button"
					style={{ marginTop: ".8rem" }}
					onClick={() =>
						void guard(() =>
							api.saveSettings({
								repetition: {
									intervalsDays: intervals
										.split(",")
										.map((part) => Number(part.trim()))
										.filter((value) => Number.isFinite(value)),
									maxIntervalDays: Number(maxInterval),
									maxRepetitions: Number(maxRepetitions),
								},
							}),
						)
					}
				>
					Зберегти
				</button>
			</Card>
		</div>
	);
}
