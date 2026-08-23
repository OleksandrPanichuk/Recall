import {
	Create,
	Datagrid,
	DeleteButton,
	Edit,
	EditButton,
	FunctionField,
	List,
	NumberField,
	ReferenceInput,
	SearchInput,
	SelectInput,
	SimpleForm,
	TextInput,
} from "react-admin";

const filters = [
	<SearchInput key="q" source="q" alwaysOn placeholder="пошук" />,
];

export function FolderList() {
	return (
		<List filters={filters} perPage={50} sort={{ field: "name", order: "ASC" }}>
			<Datagrid rowClick="edit" bulkActionButtons={false}>
				<FunctionField
					label="Назва"
					render={(record: { name: string; depth: number }) =>
						`${"— ".repeat(record.depth)}${record.name}`
					}
				/>
				<NumberField source="setCount" label="Опублікованих" />
				<NumberField source="unpublishedCount" label="Чернеток" />
				<EditButton label="" />
				<DeleteButton label="" mutationMode="pessimistic" redirect={false} />
			</Datagrid>
		</List>
	);
}

export function FolderEdit() {
	return (
		<Edit mutationMode="pessimistic" redirect="list">
			<SimpleForm>
				<TextInput source="name" label="Назва" fullWidth />
				<ReferenceInput source="parentId" reference="folders">
					<SelectInput label="Батьківська папка" fullWidth />
				</ReferenceInput>
			</SimpleForm>
		</Edit>
	);
}

export function FolderCreate() {
	return (
		<Create redirect="list">
			<SimpleForm>
				<TextInput source="name" label="Назва" fullWidth />
				<ReferenceInput source="parentId" reference="folders">
					<SelectInput label="Батьківська папка" fullWidth />
				</ReferenceInput>
			</SimpleForm>
		</Create>
	);
}
