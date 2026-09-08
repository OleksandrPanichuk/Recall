import { Module } from "@nestjs/common";
import { AttachmentsModule } from "@/modules/attachments";
import { PagesModule } from "@/modules/pages";
import { PageSharesController } from "./page-shares.controller";
import { PageSharesRepository, ShareTokens } from "./page-shares.repository";
import {
	PostgresPageSharesRepository,
	PostgresShareTokens,
} from "./repositories/page-shares.postgres.repository";
import {
	ReadSharedPageUseCase,
	SharePageUseCase,
	UnsharePageUseCase,
} from "./use-cases";

const useCases = [ReadSharedPageUseCase, SharePageUseCase, UnsharePageUseCase];

@Module({
	imports: [PagesModule, AttachmentsModule],
	controllers: [PageSharesController],
	providers: [
		{ provide: PageSharesRepository, useClass: PostgresPageSharesRepository },
		{ provide: ShareTokens, useClass: PostgresShareTokens },
		...useCases,
	],
	exports: [PageSharesRepository, ShareTokens, ...useCases],
})
export class PageSharesModule {}
