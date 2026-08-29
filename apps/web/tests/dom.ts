import { GlobalRegistrator } from "@happy-dom/global-registrator";

if (!("document" in globalThis)) {
	GlobalRegistrator.register({ url: "http://127.0.0.1/" });
}
