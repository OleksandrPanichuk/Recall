import {
	ArrayInput,
	BooleanField,
	BooleanInput,
	Create,
	Datagrid,
	DeleteButton,
	Edit,
	EditButton,
	FunctionField,
	List,
	NumberField,
	ReferenceField,
	ReferenceInput,
	SearchInput,
	SelectInput,
	SimpleForm,
	SimpleFormIterator,
	TextField,
	TextInput,
	useRecordContext,
} from "react-admin";

export const QUESTION_TYPES = [
	{ id: "single_choice", name: "одна відповідь" },
	{ id: "multiple_choice", name: "кілька відповідей" },
	{ id: "true_false", name: "правда / неправда" },
	{ id: "typed_answer", name: "написана відповідь" },
	{ id: "cloze", name: "пропуск" },
	{ id: "ordering", name: "порядок" },
	{ id: "matching", name: "пари" },
];

export const DIFFICULTIES = [
	{ id: "easy", name: "легке" },
	{ id: "medium", name: "середнє" },
	{ id: "hard", name: "складне" },
];

const shortened = (text: string): string =>
	text.length > 90 ? `${text.slice(0, 89)}…` : text;

const filters = [
	<SearchInput key="q" source="q" alwaysOn placeholder="пошук" />,
	<ReferenceInput key="set" source="quizSetId" reference="sets" alwaysOn />,
	<SelectInput
		key="difficulty"
		source="difficulty"
		choices={DIFFICULTIES}
		label="Складність"
	/>,
	<SelectInput key="type" source="type" choices={QUESTION_TYPES} label="Тип" />,
	<TextInput key="topic" source="topic" label="Тема" />,
];

export function QuestionList() {
	return (
		<List
			filters={filters}
			sort={{ field: "setTitle", order: "ASC" }}
			perPage={25}
		>
			<Datagrid rowClick="edit" bulkActionButtons={false}>
				<TextField source="setTitle" label="Набір" sortable />
				<FunctionField
					label="Питання"
					source="prompt"
					render={(record: { prompt: string }) => shortened(record.prompt)}
				/>
				<TextField source="topic" label="Тема" emptyText="—" />
				<TextField source="difficulty" label="Складність" />
				<NumberField source="answerCount" label="Відповідей" />
				<BooleanField source="editable" label="Можна змінити" looseValue />
				<EditButton label="" />
				<DeleteButton label="" mutationMode="pessimistic" redirect={false} />
			</Datagrid>
		</List>
	);
}

function Options() {
	return (
		<ArrayInput source="options" label="Варіанти">
			<SimpleFormIterator inline disableReordering={false}>
				<TextInput source="text" label="Текст" helperText={false} />
				<BooleanInput source="isCorrect" label="Правильний" />
				<TextInput source="matchKey" label="Пара" helperText={false} />
			</SimpleFormIterator>
		</ArrayInput>
	);
}

function QuestionTitle() {
	const record = useRecordContext<{ prompt?: string }>();

	return <span>{shortened(record?.prompt ?? "Питання")}</span>;
}

export function QuestionEdit() {
	return (
		<Edit title={<QuestionTitle />} mutationMode="pessimistic">
			<SimpleForm>
				<ReferenceField source="quizSetId" reference="sets" link="edit" />
				<TextInput source="type" label="Тип" disabled fullWidth />
				<TextInput source="prompt" label="Питання" multiline fullWidth />
				<SelectInput
					source="difficulty"
					choices={DIFFICULTIES}
					label="Складність"
				/>
				<TextInput source="topic" label="Тема" fullWidth />
				<TextInput source="hint" label="Підказка" fullWidth />
				<TextInput source="explanation" label="Пояснення" multiline fullWidth />
				<Options />
			</SimpleForm>
		</Edit>
	);
}

export function QuestionCreate() {
	return (
		<Create redirect="list">
			<SimpleForm
				defaultValues={{
					type: "single_choice",
					difficulty: "medium",
					options: [
						{ text: "", isCorrect: true },
						{ text: "", isCorrect: false },
					],
				}}
			>
				<ReferenceInput source="quizSetId" reference="sets">
					<SelectInput label="Набір" fullWidth />
				</ReferenceInput>
				<SelectInput source="type" choices={QUESTION_TYPES} label="Тип" />
				<TextInput source="prompt" label="Питання" multiline fullWidth />
				<SelectInput
					source="difficulty"
					choices={DIFFICULTIES}
					label="Складність"
				/>
				<TextInput source="topic" label="Тема" fullWidth />
				<TextInput source="hint" label="Підказка" fullWidth />
				<TextInput source="explanation" label="Пояснення" multiline fullWidth />
				<Options />
			</SimpleForm>
		</Create>
	);
}
