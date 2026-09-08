import { Module } from "@nestjs/common";
import { AttachmentsModule } from "@/modules/attachments";
import { PagesModule } from "@/modules/pages";
import { PageSharesPublicController } from "./page-shares.public.controller";
import { PageSharesRepository, ShareTokens } from "./page-shares.repository";
import { PageSharesSurfaceController } from "./page-shares.surface.controller";
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
	controllers: [PageSharesPublicController, PageSharesSurfaceController],
	providers: [
		{ provide: PageSharesRepository, useClass: PostgresPageSharesRepository },
		{ provide: ShareTokens, useClass: PostgresShareTokens },
		...useCases,
	],
	exports: [PageSharesRepository, ShareTokens, ...useCases],
})
export class PageSharesModule {}
