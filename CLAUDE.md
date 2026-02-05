# CLAUDE.md

## Project Overview

Dynamic Dates is an Obsidian plugin that converts natural language date phrases (e.g., "today", "next Friday", "memorial day") into wiki links pointing to daily notes. It provides autocomplete suggestions as users type and supports relative dates, weekdays, holidays (U.S., Canadian, U.K.), and custom user-defined phrases.

## Build & Test Commands

```bash
npm install        # Install dependencies
npm run build      # TypeScript check (tsc --noEmit) + esbuild bundling
npm run test       # Build + run Mocha test suite
npm run zip        # Create release package
npm version patch  # Bump version + auto-update manifest.json
```

## Architecture

- **src/main.ts** - Plugin core: settings management, prefix trie, date caching, settings UI, bulk conversion command
- **src/holidays.ts** - Date logic: holiday definitions, calendar math, `phraseToMoment()` parser, string formatting
- **src/suggest.ts** - Autocomplete engine: `DDSuggest extends EditorSuggest`, trigger detection, suggestion rendering
- **src/obsidian.d.ts** - Obsidian API type definitions
- **test/test.js** - Mocha tests with mock Obsidian/moment.js environment (test date: 2024-05-08)
- **esbuild.config.mjs** - Bundles src/main.ts into main.js (CommonJS, ES2022, `obsidian` external)

## Key Technical Details

- **Language:** TypeScript 5.8 with strict mode
- **Target:** ES2022, CommonJS output
- **Bundler:** esbuild (outputs to `main.js` at project root)
- **Testing:** Mocha 11.7 with custom mocks for Obsidian API and moment.js
- **No linter or formatter configured**
- **No production dependencies** - only devDependencies (typescript, esbuild, mocha)
- `obsidian` is marked as external in esbuild (provided by the Obsidian runtime)

## Code Conventions

- The compiled output `main.js` is checked into the repo (required by Obsidian plugin ecosystem)
- Tests are plain JavaScript in `test/test.js`, not TypeScript
- Holiday definitions use helper functions: `nthWeekdayOfMonth`, `lastWeekdayOfMonth`, `weekdayOnOrBefore`
- Plugin uses a prefix trie for efficient autocomplete matching
- Date results are cached by (phrase + current date) for performance

## CI/CD

- **node.yml:** Runs `npm test` on push to main and PRs against main (Node.js 20)
- **release.yml:** Builds and zips artifacts on GitHub release creation
