import { defineMcp } from "@lovable.dev/mcp-js";
import trackApplication from "./tools/track-application";
import listActiveBursaries from "./tools/list-active-bursaries";

export default defineMcp({
  name: "bursary-ke-mcp",
  title: "Bursary KE",
  version: "0.1.0",
  instructions:
    "Public read-only tools for Bursary KE (Kenya). Use `list_active_bursaries` to discover open bursary adverts by county or ward, and `track_application` to check the status of a submitted application by its BKE-XXXXXX tracking number. No personally identifiable information (names, phone numbers, ID numbers) is ever returned.",
  tools: [trackApplication, listActiveBursaries],
});
