# Dynamic Dates Plugin - Use Cases and Test Guide

This page describes the main scenarios the Dynamic Dates Obsidian plugin solves and outlines a set of manual checks to perform after changes to ensure functionality remains intact.

## Use Cases

1. **Automatic Date Suggestions**  
   Typing natural language phrases such as `today`, `tomorrow` or `next Monday` should trigger a suggestion for the matching calendar date. Accepting the suggestion inserts a wiki link pointing to the daily note.
2. **Relative Date Phrases**
   Expressions like `last Friday`, `the Tuesday previous` or `the Monday before` are recognized and linked appropriately. Weekday names may be abbreviated (e.g. `Tue`).
3. **Nth Weekday Parsing**  
   Phrases including `first Tuesday in July`, `second Thursday of June` or `last Friday of November` resolve to the corresponding dates.
4. **Day-of-Month References**  
   Phrases such as `the 24th` interpret the upcoming occurrence of that day in the current month (or the next month if already past).
5. **Absolute Dates**  
   Explicit dates like `May 1, 2023`, `Aug 20th` or `Jan 1` convert to links to those days.
6. **Holiday Awareness**  
   Built‑in knowledge of many U.S., Canadian and U.K. holidays means typing `memorial day` or `boxing day` links to the proper year’s holiday. Holiday groups and overrides allow selectively enabling or disabling each holiday.
7. **Custom Phrases**  
   Users can define custom phrases (for example `Mid Year`) that map to a particular month and day.
8. **Convert Entire Notes**  
   The command **Convert natural-language dates** scans the active note and replaces every recognized phrase with the appropriate wiki link.
9. **Optional Aliasing**  
   When accepting a suggestion, holding <kbd>Shift</kbd> inserts a bare link without the typed phrase as an alias.

## Manual Test Checklist
Run through these checks after making code changes or updating dependencies. Each test lists a phrase to start typing and the expected suggestion.

| Test | Begin Typing | Expected Suggestion and Result |
| --- | --- | --- |
| 1 | `tom` | Suggest `2024‑05‑09`; accepting inserts `[[2024-05-09|tomorrow]]`. |
| 2 | `next fri` | Suggest the date of the next Friday; accepting inserts a link with the typed phrase as the alias. |
| 3 | `the monday before` | Suggest the Monday of the week prior to the current date. |
| 4 | `last thanks` | Suggest last year’s Thanksgiving; accepting should keep the qualifier (`last`). |
| 5 | `first tue in july` | Suggest the correct July date for that year. |
| 6 | `may 1, 23` | Suggest `2023‑05‑01` and create a link using the typed formatting (`May 1, 23`). |
| 7 | `memorial day` | Suggest the upcoming holiday when enabled, otherwise none when disabled via settings. |
| 8 | Custom phrase (e.g. `mid year`) | Suggest the configured date like `2024‑06‑01`. |
| 9 | Run **Convert natural-language dates** on text `see you tomorrow` | Text becomes `see you [[2024-05-09|tomorrow]]`. |
| 10 | Within a fenced code block or inline code | Typing `tomorrow` should **not** trigger suggestions. |
| 11 | With <kbd>Shift</kbd> held when accepting `tom` | Result should be `[[2024-05-09]]` with no alias. |
| 12 | Start typing a multi-word custom phrase such as `start of the new semester` | The suggestion should appear once enough characters are typed, and accepting inserts the defined link. |

Performing these tests ensures the suggestion engine, date parsing, holiday logic and custom phrase handling continue to operate as intended.
