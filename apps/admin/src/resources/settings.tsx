import {
	BooleanInput,
	Button,
	Edit,
	Labeled,
	NumberInput,
	SaveButton,
	SimpleForm,
	TextField,
	TextInput,
	Toolbar,
	useNotify,
	useRecordContext,
	useRefresh,
	useUpdate,
} from "react-admin";

const joined = (value: unknown): string =>
	Array.isArray(value) ? value.join(", ") : String(value ?? "");

function InheritButton() {
	const record = useRecordContext<{ id: string; source: string }>();
	const [update, { isPending }] = useUpdate();
	const notify = useNotify();
	const refresh = useRefresh();

	if (record === undefined || record.id === "global") {
		return null;
	}

	return (
		<Button
			label="Успадкувати глобальні"
			disabled={isPending || record.source !== "set"}
			onClick={() => {
				update(
					"settings",
					{ id: record.id, data: { inheritGlobal: true } },
					{
						onSuccess: () => {
							notify("Набір знову бере глобальні налаштування");
							refresh();
						},
						onError: (error: unknown) => {
							notify(error instanceof Error ? error.message : "Не вдалося", {
								type: "error",
							});
						},
					},
				);
			}}
		/>
	);
}

function SettingsToolbar() {
	return (
		<Toolbar>
			<SaveButton />
			<InheritButton />
		</Toolbar>
	);
}

export function SettingsEdit() {
	return (
		<Edit
			resource="settings"
			mutationMode="pessimistic"
			redirect={false}
			title="Налаштування"
		>
			<SimpleForm toolbar={<SettingsToolbar />}>
				<Labeled label="Звідки беруться">
					<TextField source="source" />
				</Labeled>
				<BooleanInput source="shuffleOptions" label="Перемішувати варіанти" />
				<BooleanInput source="shuffleQuestions" label="Перемішувати питання" />
				<BooleanInput source="examMode" label="Режим екзамену" />
				<TextInput
					source="intervalsDays"
					label="Інтервали повторень (днів, через кому)"
					format={joined}
					fullWidth
				/>
				<NumberInput source="maxIntervalDays" label="Максимальний інтервал" />
				<NumberInput source="maxRepetitions" label="Максимум повторень" />
			</SimpleForm>
		</Edit>
	);
}
