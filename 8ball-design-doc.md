# Magic 8-Ball Design Doc

Living document. The code in `8ball.html` wins if this disagrees with it; propose an update here when that happens.

## 1. What it is

A Magic 8-Ball toy for friends, not a product. You type a yes/no question, the ball shakes, flips over to reveal its answer window, and a random quote from The Book of Carp appears underneath. You can turn the result into a shareable PNG card. Feel and fun matter more than features. Mobile-first, since most people will open it from a link on their phone.

Served at dontdoubtdusty.com/8ball.html from the dddsite repo (GitHub Pages).

## 2. Voice

- The answers are irreverent, crude and full of in-jokes (Twitch emotes, "Ban Juicy", "Ask Ellie"). Keep that voice. Don't sanitize, rewrite or reorder the answer list without being asked.
- The Book of Carp is a friend-group quote archive. Quotes are shown as-is, minus the index number, game tag and date.
- In-page text stays short and playful. No emojis added to page text unless asked.

## 3. The look (target)

The ball should read as a real Magic 8-Ball at a glance, built with CSS only (no image assets).

**Idle (the "8" side, facing you):**
- Glossy black sphere: a radial gradient lit from the upper left, a soft rim shadow on the lower right, and a sharp specular highlight (a small, bright, slightly blurred ellipse near the top left) plus a faint secondary reflection on the lower right.
- A centered white circle about 45% of the ball's diameter, with a bold black "8" in it. The white circle gets a subtle inner shadow so it looks printed on a curved surface.
- A soft elliptical shadow on the "floor" under the ball.

**Answering (the window side):**
- After the shake, the ball turns over to show the bottom: a dark circular window with a thin black rim, filled with deep blue "liquid".
- Inside, a blue triangle (the face of the icosahedron die) floats up from the dark: it starts small, blurred and dim, then settles to full size and sharpness.
- The answer is white, uppercase, condensed text inside the triangle, auto-shrunk so long answers still fit.
- Asking again flips back to the "8" side, shakes, and flips to a new answer.

**Motion:**
- Shake: a short, slightly randomized wobble (about 500ms), then the flip (about 400ms), then the triangle rises (about 600ms).
- `prefers-reduced-motion`: no shake or flip; the window cross-fades in and the triangle appears without the rise.

The screenshot card must use the same look as the page (see backlog item 2.4).

## 4. How it works now

One self-contained `8ball.html`: inline CSS and inline script. No build step, no npm, no framework, no backend.

- `answers`: a hard-coded array of answer strings in the script.
- `thebookofcarp.txt`: fetched at load. One quote per line, formatted `N: "quote text" [Game] [date]`. The text between the first and last double quote is shown. Lines without a quoted section are shown whole.
- Flow: `askQuestion()` shows the question and calls `shakeBall()`. `shakeBall()` animates, picks a random answer and quote, and reveals the screenshot button. Clicking the ball re-shakes for the same question.
- Screenshot: `takeScreenshot()` builds an offscreen card with inline styles, loads html2canvas 1.4.1 from cdnjs, renders it at 2x, and shows a preview modal with Copy, Download (`magic-8ball-prediction.png`) and Close.

## 5. Always preserve

- Every user-typed or file-loaded string reaches the page through `textContent` (never `innerHTML`), including in the screenshot card.
- The answer list content and the Book of Carp file format.
- The quote-extraction rule in section 4.
- The screenshot download filename `magic-8ball-prediction.png`.
- Works without the quotes file: the ball still answers, and the panel shows a fallback message.
- `prefers-reduced-motion` support (once added in 2.3).

## 6. Sanity-check list

Run after every change.

1. Type a question and press Enter: the ball shakes, flips, and shows an answer and a quote.
2. Click the button instead of Enter: same result. An empty question does nothing.
3. Click the ball again: new answer for the same question. Rapid clicking doesn't flicker or stack.
4. A question containing `<b>hi</b> & stuff` shows literally on the page and in the screenshot.
5. Screenshot: the preview matches the page look. Copy shows "Copied!" feedback; Download saves a PNG.
6. Taking a second screenshot doesn't load html2canvas again (check the Network tab).
7. Rename `thebookofcarp.txt` locally: the fallback message appears, not HTML junk.
8. Works at 375px wide with no horizontal scroll and no vertical scrollbar on load.
9. With reduced motion turned on in the OS, no shake or flip plays.
10. No console errors.

## 7. Backlog

### Phase 1: quick fixes (from the October 2026 review)

1.1 Copy feedback: pass the button into `copyToClipboard` instead of reading the global `event` inside the async `toBlob` callback; handle clipboard errors inside the callback.
1.2 Screenshot card: build the template with empty placeholder elements and fill question, answer and quote with `textContent`.
1.3 Quotes fetch: treat a non-OK response as a failure.
1.4 html2canvas: load once (skip if `window.html2canvas` exists); on load error, remove the offscreen card and tell the user.
1.5 Ignore ball clicks while a shake is in progress.
1.6 Body: `box-sizing: border-box`, remove the duplicate `padding: 0`.
1.7 Download: defer `URL.revokeObjectURL` with `setTimeout`.
1.8 Request font weight 500, or stop using it.
1.9 Accessibility: `aria-live="polite"` on the answer, `aria-label` on the input, and make the ball a `<button>` so it works by keyboard.
1.10 Remove dead CSS (`.screenshot-card h2`, `.screenshot-card .question-display`).
1.11 Change `keypress` to `keydown`.

### Phase 2: make it look like an 8-ball

2.1 Restyle the idle ball per section 3: glossy sphere, white circle with a black 8, highlights and floor shadow.
2.2 Add the window side: blue liquid, floating triangle, uppercase text that auto-shrinks to fit.
2.3 Shake, then flip, then triangle rise, with the `prefers-reduced-motion` alternative.
2.4 Rebuild the screenshot card from the same ball markup and CSS classes instead of a second copy of inline styles, so the two can't drift apart.

### Phase 3: structure (after phase 2, if wanted)

3.1 Separate state and logic (pick answer, pick quote, parse quotes) from DOM updates (render question, render answer, show panel).
3.2 Move to one `<script type="module">` and replace inline `onclick` attributes with `addEventListener`.

### Nice-to-haves (ask first)

- Don't repeat the previous answer twice in a row.
- A short shake sound, muted by default.
- Shake the phone to ask (device motion), with a button fallback.

## 8. Out of scope unless asked

- Changing, adding or removing answers or Book of Carp quotes.
- Any backend, Firebase, accounts or a shared feed.
- Image assets for the ball (it stays CSS).
- Weighting answers toward yes or no.
- Touching other pages in the repo, including the older `magic-8ball(1).html`.

## 9. Open questions

- Should the `$username` placeholder in "No, $username, mayonnaise is not an instrument" stay literal, or be filled from something?
- Is `magic-8ball(1).html` safe to delete, or is it linked from somewhere?
- When the ball flips back to the "8" side for a new question, should the old answer fade out first, or flip immediately?
