export class AdminRequestError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "AdminRequestError";
	}
}
