import { defineConfig } from "eslint/config";
import next from "eslint-config-next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig([{
  extends: [...next],
  rules: {
    // These effects intentionally initialize browser- and prop-derived modal state.
    // The updates are bounded by their dependency arrays and do not form render loops.
    'react-hooks/set-state-in-effect': 'off',
  },
}]);
