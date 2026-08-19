export interface SupervisedProcess {
	readonly name: string;
	readonly exited: Promise<number>;
	kill(): void;
}

export interface SupervisedExit {
	readonly name: string;
	readonly code: number;
}

export async function superviseProcesses(
	children: readonly SupervisedProcess[],
): Promise<SupervisedExit | undefined> {
	if (children.length === 0) {
		return undefined;
	}

	const first = await Promise.race(
		children.map(async (child) => ({
			name: child.name,
			code: await child.exited,
		})),
	);

	for (const child of children) {
		if (child.name !== first.name) {
			child.kill();
		}
	}

	await Promise.all(children.map((child) => child.exited));

	return first;
}
