# P3 — Gadget Goblin, Dress to Distress, the Mall Directory and Cart Customs

**Dates:** 25–26 November.

**Owner feedback on P2** may be in the message above this prompt. Apply it first.

**Read now:**

- `docs/LEVELS.md` §4, plus levels 3–4 in §5 and §6;
- `docs/DESIGN.md` §8–9;
- `docs/ART.md` §4, §6 (electronics, boutique) and §7;
- `NOTES.md`.

## Build, in this order

After each item, run `npm run check` and commit. Capture shots when a level becomes playable and at the end.

1. **Objects for levels 3–4:**
   - smart red/blue barriers flipped by the player's dash, with the timed fallback behind a level flag;
   - turnstile displays, sliding floor panels over a pit, robot vacuums, the laser turret, the glass case;
   - boxing gloves on pressure plates, mannequins, clothes racks;
   - catwalk bridges over clearance-bin pits, giant scissors;
   - the golden-handbag trigger and the giant yarn-ball chaser.
2. **Level 3 GADGET GOBLIN** with the electronics kit and Selfie Star.
3. **Level 4 DRESS TO DISTRESS** with the boutique kit.
4. **Meta** (`DESIGN.md` §8):
   - the flow: the first launch goes straight into level 1; after the receipt come RETRY, CART CUSTOMS and MALL DIRECTORY;
   - the wallet, and Cart Customs with the P1 upgrade tiers and cosmetics;
   - the Mall Directory and level intro cards (`ART.md` §7);
   - saves through the platform layer.
5. **Prices and medals.** Re-tune them so the first upgrade is affordable after a bronze on level 1, with levels still tuned for the base cart.

## Done when

- `npm run check` passes for levels 1–4.
- `LEVELS.md` §6 holds for levels 3 and 4, and `ART.md` §9 point 4 holds for the electronics store and the boutique.
- On a fresh profile, `DESIGN.md` §9 plays out from 0:00 to 1:15, including buying the first upgrade and seeing the cart change.
- You have looked at the `level:3`, `level:4` and `ui` shots and fixed their worst problems.

Then tag `p3`, update STATUS, and report with three things for the owner to try.

## Where the effort goes

- **Level 3** lives or dies on whether the barrier flip reads instantly. Make the solid colour unmistakable. If the bots or the owner show confusion, switch on the timed fallback.
- **Level 4** lives on the chase: the yarn ball must feel close but fair.
- **The meta screens** must look as good as the receipt.
