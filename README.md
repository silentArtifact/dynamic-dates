# dynamic-dates

Dynamic Dates is an Obsidian plugin that turns natural language phrases such as "today" or "next Friday" into wiki links pointing to your daily notes. As you type, the plugin suggests matching dates and, when accepted, replaces the phrase with a link to the corresponding note. It can also create missing daily notes on the fly and provides several options for formatting those links.

## Features

- Suggest dates while typing phrases like **today**, **tomorrow** or **next Monday**.
- Insert a wiki link to your daily note using <kbd>Tab</kbd> or <kbd>Enter</kbd>.
- Automatically create the daily note if it does not exist and optionally open it immediately.
- Customise how the link alias looks: keep the typed text, capitalise the phrase or display the formatted date.
- Define your own phrases (e.g. `Mid Year`) that map to a specific calendar date.
- Convert an entire note's text to date links via the `Convert natural-language dates` command.

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
