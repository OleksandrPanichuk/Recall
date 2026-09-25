const escaped = (value: string): string =>
	value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");

export const CONFIRM_PAGE_HEADERS = {
	"content-type": "text/html; charset=utf-8",
	"cache-control": "no-store",
	"x-frame-options": "DENY",
	"referrer-policy": "same-origin",
	"content-security-policy":
		"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
} as const;

export function confirmPage(token: string): string {
	return `<!doctype html>
<html lang="uk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Recall — вхід</title>
<style>
body{font:16px/1.5 system-ui,sans-serif;margin:0;display:grid;place-items:center;min-height:100vh;background:#111;color:#eee}
main{width:min(28rem,92vw);padding:1.5rem;background:#1c1c1c;border-radius:.75rem}
h1{font-size:1.25rem;margin:0 0 .5rem}
p{color:#bbb;margin:.5rem 0 1rem}
button{width:100%;padding:.7rem;font-size:1rem;border:0;border-radius:.4rem;background:#4f8cff;color:#fff;cursor:pointer}
</style>
</head>
<body>
<main>
<h1>Увійти в Recall?</h1>
<p>Посилання з Telegram одноразове: натисніть кнопку, щоб увійти в цьому браузері.</p>
<form method="post" action="verify">
<input type="hidden" name="token" value="${escaped(token)}">
<button type="submit" autofocus>Продовжити</button>
</form>
</main>
</body>
</html>`;
}
