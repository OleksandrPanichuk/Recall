export const spendLoginLink = (
	link: string,
	origin: string = new URL(link).origin,
): Promise<Response> => {
	const url = new URL(link);

	return fetch(`${origin}${url.pathname}`, {
		method: "POST",
		redirect: "manual",
		headers: { "content-type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({ token: url.searchParams.get("token") ?? "" }),
	});
};
