import type { PendingAuthorization } from "./provider";

const escaped = (value: string): string =>
	value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");

export function consentPage(
	pendingId: string,
	pending: PendingAuthorization,
	failed = false,
): string {
	const client = escaped(pending.clientName ?? pending.clientId);

	return `<!doctype html>
<html lang="uk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Recall — доступ</title>
<style>
body{font:16px/1.5 system-ui,sans-serif;margin:0;display:grid;place-items:center;min-height:100vh;background:#111;color:#eee}
main{width:min(28rem,92vw);padding:1.5rem;background:#1c1c1c;border-radius:.75rem}
h1{font-size:1.25rem;margin:0 0 .5rem}
p{color:#bbb;margin:.5rem 0 1rem}
label{display:block;margin-bottom:.5rem;font-size:.9rem}
input{width:100%;padding:.6rem;font-size:1rem;border-radius:.4rem;border:1px solid #444;background:#111;color:#eee;box-sizing:border-box}
button{margin-top:1rem;width:100%;padding:.7rem;font-size:1rem;border:0;border-radius:.4rem;background:#4f8cff;color:#fff;cursor:pointer}
.bad{color:#ff8a80;font-size:.9rem;margin-top:.75rem}
</style>
</head>
<body>
<main>
<h1>Дати доступ до наборів?</h1>
<p><strong>${client}</strong> просить доступ на читання й запис твоїх наборів.</p>
<form method="post" action="/consent">
<input type="hidden" name="pending" value="${escaped(pendingId)}">
<label for="passphrase">Пароль</label>
<input id="passphrase" name="passphrase" type="password" autocomplete="current-password" autofocus required>
${failed ? '<div class="bad">Пароль не підходить.</div>' : ""}
<button type="submit">Дати доступ</button>
</form>
</main>
</body>
</html>`;
}
