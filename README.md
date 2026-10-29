# dddsite

## Instructionizer (v1.01)

`instructionizer.html` builds Claude instructions from a short form. Open the page, fill in the fields, and copy the live output.

- **Project tab:** project instructions (tech, git, never-break rules, exceptions, vision) for pasting into a new Claude project.
- **Personal preferences tab:** account-wide preferences for pasting once into Claude's settings.
- **New project (guided):** a 7-step wizard (project type, name, stack, build and test, git, saved data, vision blanks) that fills the form, which stays editable.
- **Starters:** single-file web app, web app with backend, and desktop/engine game, plus a Blank start (with a confirm). Switching starters keeps the project name.
- **`{name}`** in any field is replaced with the project name in the output.
- **Copy button** with a select-text fallback.
- **Drafts** are saved in the browser (`localStorage` key `instructionBuilder.v1`) and restored on reload.
- Works at phone width, in light and dark mode.
