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

## Building

Install dependencies first:

```bash
npm install
```

Then run the build command:

```bash
npm run build
```

## Packaging for the community plugin store

Run the following command to create a release zip containing `main.js` and `manifest.json`:

```bash
npm run zip
```

Upload the generated `dynamic-dates-<version>.zip` file when creating a GitHub release.

## Continuous Integration

This project uses [GitHub Actions](https://github.com/features/actions) to run
`npm test` whenever changes are pushed or pull requests are opened against the
`main` branch. The workflow configuration lives in
`.github/workflows/node.yml`.
