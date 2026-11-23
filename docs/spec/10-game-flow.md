<!-- TOUCHLINE SPEC 1.7 · one part of the spec. Index and task map: ../SPEC.md -->
## 10. Game flow and calendar

### 10.1 Phases (state machine in `core/game/advance.ts`)
```
New Game ─▶ BoardMeeting ─▶ Preseason ─▶ TransferWindow(Preseason, rounds 1→3)
   ─▶ [ PreMatch ─▶ Match ─▶ PostMatch ─▶ WeekSummary ] × matchdays 1..9
   ─▶ TransferWindow(Midseason, rounds 1→3)
   ─▶ [ PreMatch ─▶ Match ─▶ PostMatch ─▶ WeekSummary ] × matchdays 10..18
   ─▶ SeasonEnd
Any WeekSummary may divert to ─▶ Sacked (§12.7)
```
- The user can skip the transfer windows with "Skip window" (AI rounds still resolve instantly).
- The top-bar **Continue** button (and Space) always advances to the next required step. If an action is required (e.g. invalid lineup, pending offer response with a deadline), Continue opens it instead and explains why in one sentence.

### 10.2 What happens on each advance
1. **PreMatch → Match**: lock lineups (AI picks theirs, §13.13), start worker, simulate the round's other 4 fixtures in `season.worker` instantly but reveal their goals by minute during our match ("Around the league" ticker).
2. **Match → PostMatch**: write results; update table, player stats, condition, fatigue, injuries, discipline, morale, form, board confidence, fan mood, finances (gate on home games).
3. **PostMatch → WeekSummary**: run the week (7 days): training (§12.3), development (§12.4), recovery, injury healing (−1 matchday each), suspensions served are already decremented when a match is missed, AI club transfers are only in windows, generate inbox items (§12.11), news (§16.6), conversation triggers (§12.9), wages paid (§12.10). Autosave.
4. **WeekSummary → PreMatch** (next matchday) or the transfer window after matchday 9, or SeasonEnd after matchday 18.

### 10.3 Fixture list
Circle method for 10 teams, rounds 1–9; rounds 10–18 repeat rounds 1–9 in the same order with home/away swapped. Then permute so no club has more than 2 consecutive home or away games (swap venue within pairs of rounds where needed, test it). Derbies MUST NOT occur in round 1. Kickoff: matchday ordinal per fixture via `deriveSeed(WORLD_SEED,'kickoff',fixtureId)`: 50% Afternoon, 30% Evening, 20% Night; all derbies are Night. Weather: 70% Clear, 20% Overcast, 10% Rain (deterministic per fixture). Fixtures are part of the world snapshot (identical in every save).

---

