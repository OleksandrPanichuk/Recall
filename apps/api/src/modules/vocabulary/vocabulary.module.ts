import { Module } from "@nestjs/common";
import { QuizzesModule } from "@/modules/quizzes";
import { PostgresTermPairsRepository } from "./repositories/term-pairs.postgres.repository";
import {
	AddVocabularyUseCase,
	ListVocabularyUseCase,
	UpdateVocabularyUseCase,
} from "./use-cases";
import { VocabularyController } from "./vocabulary.controller";
import { TermPairsRepository } from "./vocabulary.repository";

const useCases = [
	AddVocabularyUseCase,
	ListVocabularyUseCase,
	UpdateVocabularyUseCase,
];

@Module({
	controllers: [VocabularyController],
	imports: [QuizzesModule],
	providers: [
		{ provide: TermPairsRepository, useClass: PostgresTermPairsRepository },
		...useCases,
	],
	exports: [TermPairsRepository, ...useCases],
})
export class VocabularyModule {}
