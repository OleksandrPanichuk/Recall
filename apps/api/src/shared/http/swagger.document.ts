import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

export const SWAGGER_PATH = "docs";

export function mountSwagger(app: INestApplication): void {
	const document = SwaggerModule.createDocument(
		app,
		new DocumentBuilder()
			.setTitle("Recall API")
			.setDescription("Quizzes, practice and spaced repetition.")
			.setVersion("0.1.0")
			.build(),
	);

	SwaggerModule.setup(SWAGGER_PATH, app, document);
}
