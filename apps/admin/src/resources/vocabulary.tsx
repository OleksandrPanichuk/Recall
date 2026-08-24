import {
	Create,
	Datagrid,
	Edit,
	EditButton,
	FunctionField,
	List,
	NumberField,
	ReferenceField,
	ReferenceInput,
	SearchInput,
	SelectArrayInput,
	SelectInput,
	SimpleForm,
	TextInput,
} from "react-admin";
import { DIFFICULTIES } from "./questions";

const DIRECTIONS = [
	{ id: "term_to_translation", name: "термін → переклад" },
	{ id: "translation_to_term", name: "переклад → термін" },
];

const joined = (value: unknown): string =>
	Array.isArray(value) ? value.join(", ") : String(value ?? "");

const filters = [
	<SearchInput key="q" source="q" alwaysOn placeholder="пошук" />,
	<ReferenceInput key="set" source="quizSetId" reference="sets" alwaysOn />,
];

export function VocabularyList() {
	return (
		<List filters={filters} perPage={50}>
			<Datagrid rowClick="edit" bulkActionButtons={false}>
				<ReferenceField
					source="quizSetId"
					reference="sets"
					label="Набір"
					link="edit"
				/>
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
				<TextInput source="topic" label="Тема" disabled />
				<NumberField source="questionCount" label="Питань" />
				<EditButton label="" />
			</Datagrid>
		</List>
	);
}

export function VocabularyEdit() {
	return (
		<Edit mutationMode="pessimistic" redirect={false}>
			<SimpleForm>
				<ReferenceField source="quizSetId" reference="sets" link="edit" />
				<TextInput
					source="terms"
					label="Термін (кілька — через кому)"
					format={joined}
					fullWidth
				/>
				<TextInput
					source="translations"
					label="Переклад (кілька — через кому)"
					format={joined}
					fullWidth
				/>
				<TextInput source="transcription" label="Транскрипція" fullWidth />
				<TextInput source="example" label="Приклад" multiline fullWidth />
			</SimpleForm>
		</Edit>
	);
}

export function VocabularyCreate() {
	return (
		<Create redirect="list">
			<SimpleForm
				defaultValues={{
					directions: ["term_to_translation"],
					difficulty: "medium",
				}}
			>
				<ReferenceInput source="quizSetId" reference="sets">
					<SelectInput label="Набір" fullWidth />
				</ReferenceInput>
				<TextInput
					source="terms"
					label="Термін (кілька — через кому)"
					fullWidth
				/>
				<TextInput
					source="translations"
					label="Переклад (кілька — через кому)"
					fullWidth
				/>
				<TextInput source="transcription" label="Транскрипція" fullWidth />
				<TextInput source="example" label="Приклад" multiline fullWidth />
				<TextInput source="topic" label="Тема" fullWidth />
				<SelectInput
					source="difficulty"
					choices={DIFFICULTIES}
					label="Складність"
				/>
				<SelectArrayInput
					source="directions"
					choices={DIRECTIONS}
					label="Напрямки"
					fullWidth
				/>
			</SimpleForm>
		</Create>
	);
}
