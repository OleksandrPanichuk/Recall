import { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ApiError, api, type Overview } from "./client";
import { Card, Failure } from "./shell";
import { FoldersPage } from "./views/folders-view";
import { SetPage } from "./views/set-view";
import { SetsPage } from "./views/sets-view";
import { SettingsPage } from "./views/settings-view";

type Tab = "sets" | "folders" | "settings";

function SignIn({ onSignedIn }: { onSignedIn: () => void }) {
	const [passphrase, setPassphrase] = useState("");
	const [error, setError] = useState<string | undefined>();
	const [busy, setBusy] = useState(false);

	const submit = () => {
		setBusy(true);
		setError(undefined);
		void api
			.signIn(passphrase)
			.then(onSignedIn)
			.catch((failure: unknown) => {
				setError(failure instanceof Error ? failure.message : "Не вдалося");
			})
			.finally(() => {
				setBusy(false);
			});
	};

	return (
		<div className="login">
			<Card>
				<h2>Recall</h2>
				<label className="field">
					<span>Пароль</span>
					<input
						type="password"
						value={passphrase}
						onChange={(event) => setPassphrase(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === "Enter") {
								submit();
							}
						}}
					/>
				</label>
				<Failure error={error} />
				<button
					type="button"
					style={{ marginTop: ".8rem" }}
					disabled={busy || passphrase === ""}
					onClick={submit}
				>
					Увійти
				</button>
			</Card>
		</div>
	);
}

function Admin() {
	const [overview, setOverview] = useState<Overview | undefined>();
	const [signedIn, setSignedIn] = useState<boolean | undefined>();
	const [tab, setTab] = useState<Tab>("sets");
	const [openSet, setOpenSet] = useState<string | undefined>();
	const [error, setError] = useState<string | undefined>();

	const load = useCallback(async () => {
		try {
			setOverview(await api.overview());
			setSignedIn(true);
		} catch (failure) {
			if (failure instanceof ApiError && failure.status === 401) {
				setSignedIn(false);

				return;
			}

			setError(failure instanceof Error ? failure.message : "Не вдалося");
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	if (signedIn === false) {
		return <SignIn onSignedIn={() => void load()} />;
	}

	if (overview === undefined) {
		return (
			<div className="login">
				<Failure error={error} />
				<p className="muted">Завантаження…</p>
			</div>
		);
	}

	const tabs: readonly { readonly id: Tab; readonly label: string }[] = [
		{ id: "sets", label: "Набори" },
		{ id: "folders", label: "Папки" },
		{ id: "settings", label: "Налаштування" },
	];

	return (
		<div className="shell">
			<aside className="side">
				<h1>Recall</h1>
				<nav>
					{tabs.map((entry) => (
						<button
							type="button"
							key={entry.id}
							className={tab === entry.id && openSet === undefined ? "on" : ""}
							onClick={() => {
								setOpenSet(undefined);
								setTab(entry.id);
							}}
						>
							{entry.label}
						</button>
					))}
				</nav>
				<p className="muted" style={{ marginTop: "1.5rem" }}>
					{overview.sets.length} наборів · {overview.folders.length} папок
				</p>
				<button
					type="button"
					className="ghost"
					onClick={() =>
						void api.signOut().then(() => {
							setSignedIn(false);
							setOverview(undefined);
						})
					}
				>
					Вийти
				</button>
			</aside>

			<main className="main">
				<Failure error={error} />
				{openSet === undefined ? null : (
					<SetPage
						quizSetId={openSet}
						folders={overview.folders}
						onChanged={() => void load()}
						onClose={() => setOpenSet(undefined)}
					/>
				)}
				{openSet !== undefined ? null : tab === "sets" ? (
					<SetsPage
						sets={overview.sets}
						folders={overview.folders}
						onOpen={setOpenSet}
						onChanged={() => void load()}
					/>
				) : tab === "folders" ? (
					<FoldersPage
						folders={overview.folders}
						onChanged={() => void load()}
					/>
				) : (
					<SettingsPage
						settings={overview.settings}
						source={overview.settingsSource}
						onChanged={() => void load()}
					/>
				)}
			</main>
		</div>
	);
}

const container = document.getElementById("root");

if (container !== null) {
	createRoot(container).render(<Admin />);
}
