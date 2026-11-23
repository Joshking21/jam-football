<!-- TOUCHLINE SPEC 1.7 · one part of the spec. Index and task map: ../SPEC.md -->
## 15. The assistant coach

Name: **Theo Vance**, assistant manager (fictional). Portrait `images/people/assistant.webp`; voice lines in `audio/vo/assistant/` (§17).

### 15.1 Advice engine (`core/people/assistant.ts`)
Pure function `advise(context): Advice[]` where `Advice = { id, priority: 1–3, text, reason, apply?: AdviceAction }` and `AdviceAction` is one of: set instructions (partial), change formation, substitute (out, in), set training, rest player. Text and reasons come from `content/assistant.json` templates with `{player}`, `{lane}`, `{opponent}` tokens.

### 15.2 Pre-match rules (opponent report)
Compute from the opponent's sheet and our squad:
- Opponent pressing High and our back line pace avg ≥ 65 → "Play out quickly: Passing Mixed, Tempo Fast."
- Opponent line High and our best forward pace ≥ 75 → "Go in behind: Passing Direct, Focus toward that forward's lane."
- Opponent's weakest defender (lowest OVR among their back line) on side X → "Attack their {side}: Focus {lane}."
- Opponent avg OVR ≥ ours + 4 → "Stay compact: Mentality Defensive, Line Deep, Pressing Mid."
- Opponent avg OVR ≤ ours − 4 → "Take the game to them: Mentality Attacking."
- Our CBs heading avg ≥ 72 and their crosses-heavy (Width Wide) → reassurance line, no change.
Pick at most 3, highest priority first; "Apply all" applies them together.

### 15.3 Week tips (Hub and inbox)
One tip per week, first matching rule: a player with fatigue > 80 ("Rest {player}"), formation familiarity < 50 for the current formation ("Train Tactical"), ≥ 3 players condition < 70 before a match ("Light training this week"), an unhappy Star ("Talk to {player}"), a prospect with potential ≥ 78 and < 2 apps in the last 6 ("Give {player} minutes"), else a positive note.

### 15.4 In-match rules (evaluated every 5 match minutes from the last 15 minutes of events)
| Trigger | Advice (with Apply) |
|---|---|
| ≥ 50% of opponent's ATT-third entries come through one of our flanks and they had ≥ 3 shots from it | "They're getting joy down our {lane}. Tell {fullback} to stay back." → that FB role `fb_defensive`; if already, Width Narrow |
| Our pressing High and our avg condition < 62 | "The lads are running out of legs. Drop the press." → Pressing Mid |
| Our crosses ≥ 6 with success < 20% and their CB heading avg > our ST heading avg + 5 | "We're losing every header. Keep it on the floor." → Width Narrow, Passing Short |
| Opponent line High and we had ≥ 2 offsides | "Their line is high; time the runs, go direct." → Passing Direct |
| A player with condition < 58 and subs left | "{player} is out on his feet." → sub with best like-for-like bench player |
| A player on a yellow committed ≥ 2 more fouls | "{player} is one tackle from a red." → sub |
| Losing at 70'+ | "We need a goal. Go for it." → Mentality Attacking, Tempo Fast |
| Winning by 1 at 80'+ | "See it out." → Mentality Defensive, Tempo Slow |
| Our possession < 35% over the window and Passing Direct | "We keep giving it away. Calm it down." → Passing Short, Tempo Slow |
At most one new advice per 5 minutes; max 6 per match; do not repeat an advice id within 20 minutes. Each advice plays a short voiced stinger (§17.4) and shows in the assistant drawer with Apply / Dismiss.

### 15.5 Half-time and post-match analysis
- Half-time: 2–3 bullets from: shots/xG comparison ("We've created 0.4 xG to their 1.3"), the most dangerous opposing player (most involvement in shots), our worst-rated starter (suggest a sub), and one rule from §15.4 if it applies.
- Post-match: one paragraph from templates: result vs expectation, best player, a stat that decided the match (biggest gap among shots on target, xG, possession, cards), what to work on (maps to a training focus with an Apply button for next week).

---

