# dynamic-dates

Dynamic Dates is an Obsidian plugin that turns natural language phrases such as "today" or "next Friday" into wiki links pointing to your daily notes. As you type, the plugin suggests matching dates and, when accepted, replaces the phrase with a link to the corresponding note. It provides several options for formatting those links.

## Features

- Suggest dates while typing phrases like **today**, **tomorrow** or **next Monday**.
- Understand phrases such as **the Tuesday previous** or **the Monday before**,
  as well as **first Tuesday in July** style expressions.
- Insert a wiki link to your daily note using <kbd>Tab</kbd> or <kbd>Enter</kbd>.
- Define your own phrases (e.g. `Mid Year`) that map to a specific calendar date.
- Convert an entire note's text to date links via the `Convert natural-language dates` command.
- Built-in awareness of holidays across multiple regions, including U.S., Canadian and U.K. observances, with settings to enable or disable entire holiday groups or individual holidays.

## Usage

Open **Settings → Dynamic Dates** to configure how suggestions are inserted.  The
tab lets you choose the accept key, toggle the <kbd>Shift</kbd> behaviour, and
provides controls for holidays and custom phrases.

- **Enable holiday groups**: Click **Holiday settings** then toggle a group such
  as U.S. or U.K. holidays.  Expanding a group shows individual holidays that
  can be switched on or off.
- **Add custom date phrases**: Under **Custom date mappings** use the **Add
  mapping** button to create phrases that resolve to a fixed month/day
  (e.g. `Mid Year` → `06-01`).
- **Convert natural-language dates**: Run the command of the same name from the
  command palette to scan the active note and replace recognized phrases with
  wiki links.

## Building

Install dependencies first:

```bash
npm install
```

Then run the build command:

```bash
npm run build
```

This compiles the TypeScript source and copies everything in `dist/` to the
project root, preserving any subdirectories.

## Packaging for the community plugin store

Run the following command to create a release zip containing the compiled JavaScript files and manifest:

```bash
npm run zip
```

This will produce `dynamic-dates-<version>.zip` containing `main.js`, `plugin.js`,
`holidays.js`, `suggest.js`, `manifest.json`, `README.md` and `LICENSE`. Upload
this file when creating a GitHub release.

When preparing a new release, run one of the standard version commands such as:

```bash
npm version patch
```

This will bump `package.json` and automatically update `manifest.json` via the
`version` script so that both files share the same version number.

## Continuous Integration

This project uses [GitHub Actions](https://github.com/features/actions) to run
`npm test` whenever changes are pushed or pull requests are opened against the
`main` branch. The workflow configuration lives in
`.github/workflows/node.yml`.

## Testing

Automated tests run via `npm test`.
For manual test steps, see [docs/wiki-use-cases-and-tests.md](docs/wiki-use-cases-and-tests.md).
