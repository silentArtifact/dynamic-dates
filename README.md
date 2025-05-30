# dynamic-dates
A plugin for Obsidian that lets you type natural language dates ("today", "next Friday"…) and automatically link them to your daily notes.

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
