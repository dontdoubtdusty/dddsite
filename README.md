# dddsite

My personal projects site, live at [dontdoubtdusty.com](https://dontdoubtdusty.com) (GitHub Pages). It's a flat set of static HTML pages with no build step. `index.html` is the landing page and links to the 8-Ball and the Book of Carp. Everything else is reachable by URL.

## Pages

**Main**
- `index.html`: landing page.
- `8ball.html`: Magic 8-Ball that draws its answers from `thebookofcarp.txt` (design notes in `8ball-design-doc.md`).
- `thebookofcarp.html` and `quotes.html`: the Book of Carp intro and its sayings.
- `instructionizer.html`: Claude instructions builder (see below).
- `birbcubemanual.html`: Birb Cube assembly manual.

**Games and tools**
- `dice.html`: Shrek Dice.
- `booster.html` (with `names/`): booster pack generator.
- `mtgadvent.html` (with `mtgadvent.js` and `draftsets.json`): MTG draft advent calendar built from sets legal in Standard that December. Refresh it each year with `node tools/mtgadvent-build.js <year>`; it pulls the set list, icons and art from Scryfall and keeps hand-written blurbs and day titles. To preview a day before it is live, open `mtgadvent.html?date=2026-12-07`: a test banner appears with day-by-day buttons, and test mode stores its opened doors separately from real visitors.
- `mtg-random-card.html`: random card from the Scryfall API.
- `card_game.html` and `cards/`: Eras of Conflict card game.
- `bookchart.html`: Reading Flow Tool.
- `shoracle.html`: Shrek tarot reader.
- `notepad-recreation.html`: Shrekpad.
- `tierlist.html`: tier list.

**Archives**
- `fhrquotes.html` and `fhr/`: Full House Revisited recaps.
- `stepbystep_reviewed.html`, `sbsrposts.json` and `stepbystepreviewed/`: Step By Step Reviewed.

**Calendars and misc**
- `colorcalendar.html`: 365 Days of New Year's Colors.
- `cinco-de-mayo-nachos.html`, `recipes.html`, `mybibles.html`.
- `sun_space_map.html`, `space_transfer.html`, `the_eye.html`, `town/town.html`.
- `bear.html`, `beards.html`, `donotresist.html`, `hypnotic_with_bg.html`, `usps_mockery.html`, `yawn_pumpkin.html`: one-off jokes and demos.

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
