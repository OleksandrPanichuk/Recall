import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

@ApiTags("health")
@Controller()
export class HealthController {
	@Get("health/live")
	live(): { readonly status: string } {
		return { status: "ok" };
	}

	@Get("health/ready")
	ready(): { readonly status: string } {
		return { status: "ok" };
	}
}
