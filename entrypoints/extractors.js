import "../lib/cleaners.js";
import "../lib/debug.js";
import "../lib/extractors/core.js";
import "../lib/extractors/accessibility-tree.js";
import "../lib/extractors/selected-text.js";
import "../lib/extractors/pdf.js";
import "../lib/extractors/youtube.js";
import "../lib/extractors/webpage.js";
import "../lib/extractors/course.js";
import "../lib/extractors.js";

// This is intentionally an unlisted entrypoint. The background injects the
// compiled bundle only when a page needs its first extraction request.
export default defineUnlistedScript(() => {});
