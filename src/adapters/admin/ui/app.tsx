import {
	Admin,
	Layout,
	type LayoutProps,
	Menu,
	Resource,
	radiantDarkTheme,
	radiantLightTheme,
} from "react-admin";
import { createRoot } from "react-dom/client";
import { LoginPage } from "./login";
import { authProvider, dataProvider } from "./providers";
import { FolderCreate, FolderEdit, FolderList } from "./resources/folders";
import {
	QuestionCreate,
	QuestionEdit,
	QuestionList,
} from "./resources/questions";
import { SetCreate, SetEdit, SetList } from "./resources/sets";
import { SettingsEdit } from "./resources/settings";
import {
	VocabularyCreate,
	VocabularyEdit,
	VocabularyList,
} from "./resources/vocabulary";

function AdminMenu() {
	return (
		<Menu>
			<Menu.ResourceItem name="sets" />
			<Menu.ResourceItem name="questions" />
			<Menu.ResourceItem name="vocabulary" />
			<Menu.ResourceItem name="folders" />
			<Menu.Item
				to="/settings/global"
				primaryText="Налаштування"
				leftIcon={<span>⚙</span>}
			/>
		</Menu>
	);
}

function AdminLayout(props: LayoutProps) {
	return <Layout {...props} menu={AdminMenu} />;
}

export function AdminApp() {
	return (
		<Admin
			title="Recall"
			dataProvider={dataProvider}
			authProvider={authProvider}
			loginPage={LoginPage}
			layout={AdminLayout}
			theme={radiantLightTheme}
			darkTheme={radiantDarkTheme}
			defaultTheme="dark"
			requireAuth
		>
			<Resource
				name="sets"
				options={{ label: "Набори" }}
				list={SetList}
				edit={SetEdit}
				create={SetCreate}
				recordRepresentation="title"
			/>
			<Resource
				name="questions"
				options={{ label: "Питання" }}
				list={QuestionList}
				edit={QuestionEdit}
				create={QuestionCreate}
				recordRepresentation="prompt"
			/>
			<Resource
				name="vocabulary"
				options={{ label: "Словник" }}
				list={VocabularyList}
				edit={VocabularyEdit}
				create={VocabularyCreate}
			/>
			<Resource
				name="folders"
				options={{ label: "Папки" }}
				list={FolderList}
				edit={FolderEdit}
				create={FolderCreate}
				recordRepresentation="name"
			/>
			<Resource name="settings" edit={SettingsEdit} />
			<Resource name="attempts" />
		</Admin>
	);
}

const container = document.getElementById("root");

if (container !== null) {
	createRoot(container).render(<AdminApp />);
}
