# Getting started

This file is for you, Amir. Claude Code reads the rest.

## What is in the archive

| File | Purpose |
| --- | --- |
| `CLAUDE.md` | The brief: Claude Code reads it automatically when the folder is opened |
| `docs/GDD.md` | Game design v2 |
| `docs/QUALITY.md` | Quality bar, milestones, playtest questions |
| `docs/ART.md` | Visual and audio style |
| `docs/MINDBLOWN.md` | Platform constraints and the handoff format |
| `docs/RESEARCH.md` | Supermarket Shriek teardown and sources for each technique |
| `references/README.md` | Reference links and a list of images worth saving |
| `tune.json` | Starting values in the Mindblown format |

Working GDD v1, with the level diagram and the full research, stays in Claude: <https://claude.ai/artifact/8eCUQKSQZRZSSq7DHKhAsi>. For the build, `docs/GDD.md` from this archive is what counts.

## Steps

1. Unpack the archive into an empty folder. It becomes the project root.
2. Save 6–10 images into `references/` following the list in `references/README.md`. It works without them too, but with them the visuals will be more precise.
3. Open the folder in Claude Code and select the Fable 5.2 model.
4. Paste the starting prompt.
5. At each milestone gate, Claude Code stops with a report and questions. Play for 5–10 minutes and answer honestly: it is the only way to tune the feel.

## Starting prompt

```text
Read CLAUDE.md, then every document in docs/ in the order given there, tune.json, and the images in references/ if there are any. Re-read https://mindblown.ai/skill.md and https://mindblown.ai/sdk.md: they are the primary source on the platform.

I need the best game of the jam, not a completed checklist. Work as a lead developer who owns the result.

First, briefly:
1. Summarize in ten lines how you understand the game and the quality bar.
2. Name the main risks and what you would change in the design if you see a way to make it better.
3. Show the plan for milestones M0–M7.

Ask only the questions you cannot start without. Then go straight into M0 and M1 and stop at the M1 gate: report, numbers and playtest questions.
```

## How to answer at a gate

```text
Milestone M1. Answers to your questions: …
What I liked: …
What annoys me: …
Decision: accept / rework this: …
```

Specifics beat ratings. "The drift breaks when I let go of the steering" is more useful than "the controls are meh".

## Prompts for later

- "Accepted. Continue to the next milestone gate."
- "The feel is off: … Don't add anything new until you fix this."
- "Run 200 bot runs on every level and show a table against the criteria in QUALITY.md, section 4."
- "Go through the rush-job signs in QUALITY.md, section 3: show what you found and fix it."
- "Capture ten random frames from a run and check them yourself against the art acceptance in ART.md, section 9."
- "Build the handoff package from MINDBLOWN.md, section 6, and check it on a clean copy of the project."

## What stays with you

- **Ask the organizers** in the cup's Discord before the move: will they accept a game whose code was written in Claude Code and handed to the Mindblown AI, and do the judges play on desktop or mobile?
- **Play at the gates.** M1 (controls) and M3 (visuals) matter most: they are the cheapest to fix right away.
- **The move.** By the evening of 29 November the project will contain `HANDOFF.md` and `dist/index.html`. You hand those and the project files to the Mindblown AI.
