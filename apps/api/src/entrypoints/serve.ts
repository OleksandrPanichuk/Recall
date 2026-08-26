import { startApi } from "./api";

// A file whose only job is to start: import.meta.main is a Bun-ism, and this app
// is also started by node from dist/.
await startApi();
