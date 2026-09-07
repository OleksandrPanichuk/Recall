import type { Clock } from "@/application/ports/clock";
import type {
	PageShare,
	RepositoryScope,
} from "@/application/ports/repositories/page.repository";
import type { UnitOfWork } from "@/application/ports/unit-of-work";
import type {
	ApplicationDependencies,
	Command,
	UseCase,
} from "@/application/use-case";
import { type PageId, PagesService } from "@/modules/pages";

export interface SharePageCommand {
	readonly folderId: PageId;
	readonly rotate?: boolean;
}

export interface SharedPage {
	readonly folderId: PageId;
	readonly name: string;
	readonly token: string;
	readonly createdAt: Date;
}

export type SharePageDependencies = ApplicationDependencies;

export class SharePageUseCase
	implements UseCase<Command<SharePageCommand>, SharedPage>
{
	private readonly unitOfWork: UnitOfWork<RepositoryScope>;
	private readonly tokens: ApplicationDependencies["idGenerator"];
	private readonly clock: Clock;

	constructor(dependencies: SharePageDependencies) {
		this.unitOfWork = dependencies.unitOfWork;
		this.tokens = dependencies.idGenerator;
		this.clock = dependencies.clock;
	}

	execute(request: Command<SharePageCommand>): Promise<SharedPage> {
		return this.unitOfWork.run(async ({ pages }) => {
			const page = await new PagesService(pages).require(request.folderId);
			const existing = await pages.shareOf(page.id);

			if (existing !== undefined && request.rotate !== true) {
				return {
					folderId: page.id,
					name: page.name,
					token: existing.token,
					createdAt: existing.createdAt,
				};
			}

			const share: PageShare = {
				pageId: page.id,
				token: `${this.tokens.generate()}${this.tokens.generate()}`.replaceAll(
					"-",
					"",
				),
				createdAt: this.clock.now(),
			};

			await pages.saveShare(share);

			return {
				folderId: page.id,
				name: page.name,
				token: share.token,
				createdAt: share.createdAt,
			};
		});
	}
}

export interface UnsharePageCommand {
	readonly folderId: PageId;
}

export class UnsharePageUseCase
	implements UseCase<Command<UnsharePageCommand>, void>
{
	private readonly unitOfWork: UnitOfWork<RepositoryScope>;

	constructor(dependencies: SharePageDependencies) {
		this.unitOfWork = dependencies.unitOfWork;
	}

	async execute(request: Command<UnsharePageCommand>): Promise<void> {
		await this.unitOfWork.run(async ({ pages }) => {
			const page = await new PagesService(pages).require(request.folderId);

			await pages.deleteShare(page.id);
		});
	}
}
