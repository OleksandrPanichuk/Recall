import { Module } from "@nestjs/common";
import { PagesRepository } from "./pages.repository";
import { PagesService } from "./pages.service";
import { PostgresPagesRepository } from "./repositories/pages.postgres.repository";
import {
	AttachQuizUseCase,
	BrowseFolderUseCase,
	CreatePageUseCase,
	DeletePageUseCase,
	DetachQuizUseCase,
	EnsurePagePathUseCase,
	ListPageRevisionsUseCase,
	ListPageTreeUseCase,
	MovePageUseCase,
	RenamePageUseCase,
	ReorderPageUseCase,
	ResolvePagePathUseCase,
	SearchPagesUseCase,
	SetPageIconUseCase,
	WriteSummaryUseCase,
} from "./use-cases";

const useCases = [
	AttachQuizUseCase,
	BrowseFolderUseCase,
	CreatePageUseCase,
	DeletePageUseCase,
	DetachQuizUseCase,
	EnsurePagePathUseCase,
	ListPageRevisionsUseCase,
	ListPageTreeUseCase,
	MovePageUseCase,
	RenamePageUseCase,
	ReorderPageUseCase,
	ResolvePagePathUseCase,
	SearchPagesUseCase,
	SetPageIconUseCase,
	WriteSummaryUseCase,
];

@Module({
	providers: [
		{ provide: PagesRepository, useClass: PostgresPagesRepository },
		PagesService,
		...useCases,
	],
	exports: [PagesRepository, PagesService, ...useCases],
})
export class PagesModule {}
