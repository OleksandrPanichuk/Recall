export class UnsafeMigrationError extends Error {
	public readonly tag: string;
	public readonly marker: string;

	constructor(tag: string, marker: string) {
		super(
			`${tag}.sql rebuilds a table (${marker}) but is not declared as a rebuild. Add the "-- rebuild" marker on the first line so the migrator applies it with foreign keys disabled outside a transaction; applying it inline would let the DROP TABLE cascade child rows away.`,
		);
		this.name = "UnsafeMigrationError";
		this.tag = tag;
		this.marker = marker;
	}
}

export class RebuildFailedError extends Error {
	public readonly tag: string;
	public readonly violations: number;

	constructor(tag: string, violations: number) {
		super(
			`${tag}.sql left ${violations} foreign key violation(s); the rebuild was rolled back and nothing was recorded.`,
		);
		this.name = "RebuildFailedError";
		this.tag = tag;
		this.violations = violations;
	}
}
