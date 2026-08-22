import { useState } from "react";
import { Login, useLogin, useNotify } from "react-admin";

export function LoginPage() {
	const login = useLogin();
	const notify = useNotify();
	const [passphrase, setPassphrase] = useState("");
	const [busy, setBusy] = useState(false);

	const submit = (event: { preventDefault(): void }): void => {
		event.preventDefault();
		setBusy(true);
		login({ password: passphrase })
			.catch((error: unknown) => {
				notify(error instanceof Error ? error.message : "Пароль не підходить", {
					type: "error",
				});
			})
			.finally(() => {
				setBusy(false);
			});
	};

	return (
		<Login>
			<form onSubmit={submit} style={{ padding: "1.5rem" }}>
				<label
					htmlFor="admin-passphrase"
					style={{ display: "block", marginBottom: ".4rem" }}
				>
					Пароль
				</label>
				<input
					id="admin-passphrase"
					type="password"
					value={passphrase}
					onChange={(event) => setPassphrase(event.target.value)}
					style={{ width: "100%", padding: ".5rem", marginBottom: ".8rem" }}
				/>
				<button type="submit" disabled={busy || passphrase.length === 0}>
					Увійти
				</button>
			</form>
		</Login>
	);
}
