import { useEffect, useState } from "react";
import {
	Create,
	CreateButton,
	Datagrid,
	DateField,
	Edit,
	EditButton,
	FunctionField,
	Labeled,
	List,
	NumberField,
	ReferenceField,
	ReferenceInput,
	ReferenceManyField,
	SearchInput,
	SelectInput,
	SimpleForm,
	TabbedForm,
	TextField,
	TextInput,
	TopToolbar,
	useRecordContext,
} from "react-admin";

export const STATUSES = [
	{ id: "draft", name: "чернетка" },
	{ id: "published", name: "опублікований" },
	{ id: "archived", name: "архів" },
];

const filters = [
	<SearchInput key="q" source="q" alwaysOn placeholder="пошук" />,
	<SelectInput key="status" source="status" choices={STATUSES} label="Стан" />,
	<ReferenceInput key="folder" source="folderId" reference="folders" />,
];

export function SetList() {
	return (
		<List
			filters={filters}
			sort={{ field: "title", order: "ASC" }}
			perPage={25}
		>
			<Datagrid rowClick="edit" bulkActionButtons={false}>
				<TextField source="title" label="Назва" />
				<TextField source="status" label="Стан" />
				<NumberField source="questionCount" label="Питань" />
				<ReferenceField
					source="folderId"
					reference="folders"
					label="Папка"
					emptyText="—"
					link={false}
				/>
				<TextField source="language" label="Мова" />
				<DateField source="updatedAt" label="Змінено" showTime />
				<EditButton label="" />
			</Datagrid>
		</List>
	);
}

interface Statistics {
	readonly setAccuracy: {
		readonly correct: number;
		readonly total: number;
		readonly percentage: number;
	};
	readonly attempts: readonly {
		readonly attemptId: string;
		readonly completedAt?: string;
		readonly score: { readonly percentage: number };
	}[];
	readonly topics: readonly {
		readonly topic: string;
		readonly answered: number;
		readonly correct: number;
	}[];
}

function SetStatistics() {
	const record = useRecordContext<{ id: string }>();
	const [statistics, setStatistics] = useState<Statistics | undefined>();
	const [failed, setFailed] = useState(false);
	const id = record?.id;

	useEffect(() => {
		if (id === undefined) {
			return;
		}

		let live = true;

		void fetch(`/api/statistics/${id}`)
			.then((response) => (response.ok ? response.json() : Promise.reject()))
			.then((body: Statistics) => {
				if (live) {
					setStatistics(body);
				}
			})
			.catch(() => {
				if (live) {
					setFailed(true);
				}
			});

		return () => {
			live = false;
		};
	}, [id]);

	if (failed) {
		return <p>Не вдалося прочитати статистику.</p>;
	}

	if (statistics === undefined) {
		return <p>Читаю статистику…</p>;
	}

	if (statistics.attempts.length === 0) {
		return <p>Цей набір ще не проходили.</p>;
	}

	return (
		<div>
			<p>
				Точність: <strong>{statistics.setAccuracy.percentage}%</strong> (
				{statistics.setAccuracy.correct} з {statistics.setAccuracy.total}) ·
				спроб: {statistics.attempts.length}
			</p>

			<h4>За темами</h4>
			<table>
				<thead>
					<tr>
						<th align="left">Тема</th>
						<th align="right">Правильно</th>
						<th align="right">Відповідей</th>
					</tr>
				</thead>
				<tbody>
					{statistics.topics.map((topic) => (
						<tr key={topic.topic}>
							<td>{topic.topic}</td>
							<td align="right">{topic.correct}</td>
							<td align="right">{topic.answered}</td>
						</tr>
					))}
				</tbody>
			</table>

			<h4>Спроби</h4>
			<table>
				<thead>
					<tr>
						<th align="left">Коли</th>
						<th align="right">Результат</th>
					</tr>
				</thead>
				<tbody>
					{statistics.attempts.map((attempt) => (
						<tr key={attempt.attemptId}>
							<td>
								{attempt.completedAt === undefined
									? "не завершена"
									: new Date(attempt.completedAt).toLocaleString()}
							</td>
							<td align="right">{attempt.score.percentage}%</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

function AddQuestionButton() {
	const record = useRecordContext<{ id: string }>();

	return (
		<TopToolbar>
			<CreateButton
				resource="questions"
				label="Додати питання"
				state={{
					record: { quizSetId: record?.id },
				}}
			/>
		</TopToolbar>
	);
}

function AddVocabularyButton() {
	const record = useRecordContext<{ id: string }>();

	return (
		<TopToolbar>
			<CreateButton
				resource="vocabulary"
				label="Додати пару"
				state={{
					record: { quizSetId: record?.id },
				}}
			/>
		</TopToolbar>
	);
}

function SettingsLink() {
	const record = useRecordContext<{ id: string }>();

	return (
		<p>
			<a href={`#/settings/${record?.id}`}>Налаштування саме цього набору →</a>
		</p>
	);
}

export function SetEdit() {
	return (
		<Edit mutationMode="pessimistic" redirect={false}>
			<TabbedForm>
				<TabbedForm.Tab label="Набір">
					<TextInput source="title" label="Назва" fullWidth />
					<TextInput source="language" label="Мова" />
					<TextInput source="description" label="Опис" multiline fullWidth />
					<TextInput source="source" label="Джерело" fullWidth />
					<TextInput source="sourceChapters" label="Розділи" fullWidth />
					<TextInput
						source="tags"
						label="Теги (через кому)"
						format={(value: unknown) =>
							Array.isArray(value) ? value.join(", ") : String(value ?? "")
						}
						fullWidth
					/>
					<SelectInput source="status" choices={STATUSES} label="Стан" />
					<ReferenceInput source="folderId" reference="folders">
						<SelectInput label="Папка" fullWidth />
					</ReferenceInput>
					<Labeled label="Питань">
						<NumberField source="questionCount" />
					</Labeled>
					<SettingsLink />
				</TabbedForm.Tab>

				<TabbedForm.Tab label="Питання">
					<AddQuestionButton />
					<ReferenceManyField
						reference="questions"
						target="quizSetId"
						label={false}
						perPage={50}
						sort={{ field: "position", order: "ASC" }}
					>
						<Datagrid rowClick="edit" bulkActionButtons={false}>
							<NumberField source="position" label="#" />
							<FunctionField
								label="Питання"
								render={(record: { prompt: string }) =>
									record.prompt.length > 80
										? `${record.prompt.slice(0, 79)}…`
										: record.prompt
								}
							/>
							<TextField source="type" label="Тип" />
							<TextField source="topic" label="Тема" emptyText="—" />
							<NumberField source="answerCount" label="Відповідей" />
							<EditButton label="" />
						</Datagrid>
					</ReferenceManyField>
				</TabbedForm.Tab>

				<TabbedForm.Tab label="Словник">
					<AddVocabularyButton />
					<ReferenceManyField
						reference="vocabulary"
						target="quizSetId"
						label={false}
						perPage={50}
					>
						<Datagrid rowClick="edit" bulkActionButtons={false}>
							<FunctionField
								label="Термін"
								render={(record: { terms: readonly string[] }) =>
									record.terms.join(" / ")
								}
							/>
							<FunctionField
								label="Переклад"
								render={(record: { translations: readonly string[] }) =>
									record.translations.join(" / ")
								}
							/>
							<NumberField source="questionCount" label="Питань" />
							<EditButton label="" />
						</Datagrid>
					</ReferenceManyField>
				</TabbedForm.Tab>

				<TabbedForm.Tab label="Статистика">
					<SetStatistics />
				</TabbedForm.Tab>
			</TabbedForm>
		</Edit>
	);
}

export function SetCreate() {
	return (
		<Create redirect="edit">
			<SimpleForm defaultValues={{ language: "uk" }}>
				<TextInput source="title" label="Назва" fullWidth />
				<TextInput source="language" label="Мова" />
				<TextInput source="description" label="Опис" multiline fullWidth />
				<TextInput source="source" label="Джерело" fullWidth />
				<TextInput source="sourceChapters" label="Розділи" fullWidth />
				<ReferenceInput source="folderId" reference="folders">
					<SelectInput label="Папка" fullWidth />
				</ReferenceInput>
			</SimpleForm>
		</Create>
	);
}
