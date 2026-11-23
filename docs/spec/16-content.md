<!-- TOUCHLINE SPEC 1.7 · one part of the spec. Index and task map: ../SPEC.md -->
## 16. Content files

All content is JSON in `src/content/`, with stable string ids (`snake_case`). Text uses tokens in `{curly}` braces: `{player}`, `{player2}`, `{team}`, `{opponent}`, `{score}`, `{minute}`, `{manager}`, `{stadium}`, `{lane}`. A validation test checks every file: ids unique, tokens from the allowed list, no empty strings, minimum counts met.

### 16.1 Commentary (`commentary.json`)
Two voices: **PBP** (play-by-play, "Callum") and **COL** (colour/co-commentator, "Nadia"). Structure:
```json
{ "lines": [ { "id": "goal_generic_01", "key": "GOAL", "voice": "PBP", "text": "{player}... and it's in! What a finish!", "nameSlot": "start", "intensity": 3 } ] }
```
- `nameSlot`: `"start"` (the name is spoken first, then the line audio), `"none"`. Lines with a name token anywhere other than the start are not allowed (audio is chained: `names/{playerId}.mp3` + `commentary/{id}.mp3`). Captions always show the full text.
- Keys and minimum line counts: KICKOFF 6, PASS_RUN (general flow) 20, LONG_BALL 6, DRIBBLE 8, TACKLE 8, INTERCEPTION 6, CROSS 8, HEADER 6, THROUGH_BALL 6, OFFSIDE 6, SHOT_SAVE 10, SHOT_MISS 10, SHOT_BLOCK 6, POST 5, BIG_CHANCE_MISS 6, GOAL 14, GOAL_HEADER 5, GOAL_LONG_RANGE 5, GOAL_PENALTY 4, PENALTY_AWARDED 5, PENALTY_SAVED 4, FREE_KICK 5, CORNER 6, FOUL 6, YELLOW 6, RED 5, INJURY 4, SUB 5, HALF_TIME 6, FULL_TIME_WIN_HOME 4, FULL_TIME_WIN_AWAY 4, FULL_TIME_DRAW 4, ADDED_TIME 4, COLOUR_ANALYSIS (COL generic insight lines: "That's the third time they've gone down that flank") 20, DERBY_INTRO 4, LATE_DRAMA 5. Total ≥ 250 lines.
- Selection: per event type pick a line not used in the last 30 lines; at most 1 PBP line per 6 sim seconds outside importance ≥ 2; COL lines follow 25% of importance ≥ 2 events after a 1.2 s gap.

**v1.7 (23 Nov, the user): story-led commentary.** Callum (PBP) tells the story; Nadia (COL) reads the game. Lines are no longer one-per-event filler:
- **Tags.** A line may carry `tags`. The commentary module builds the situation's tag set for each event and picks, among the lines for that key, one whose tags are **all** in the set, preferring the line that matches the **most** tags (ties: not used in the last 30 lines, then random). Untagged lines are the fallback.
- **Player tags** (the scorer, actor or named player): `young` (≤ 20), `veteran` (≥ 32), `captain`, `newSigning` (joined this season), `formerClub` (playing his last club), `returning` (first 2 matches back from a 3+ matchday injury), `firstGoal` (first for the club), `brace`, `hatTrick`, `topScorer` (club's top scorer), `inForm` (avg rating ≥ 7.4 over the last 3), `outOfForm` (≤ 6.2 over the last 3, or no goal in 6 for a forward), `contractEnding` (1 year left), `sub` (came on), `defender`, `keeper`.
- **Match tags:** `derby`, `titleRace` (either side top 3 after MD6, or the leader), `relegation` (either side bottom 3 after MD6), `opener`, `equaliser`, `winner` (puts a side ahead after 80'), `comeback` (from 2 down to level or ahead), `rout` (lead ≥ 3), `late` (≥ 85'), `homeWinning`, `homeLosing`, `level`, `tenMen`, `night`, `afternoon`, `rain`, `openingDay`, `finalDay`, `bigGap` (average OVR gap ≥ 6).
- **Analysis tags** (for `ANALYSIS`, from the same signals as the §15.4 assistant rules over the last 15 minutes): `flankOverload`, `pressingWorking`, `pressingTired`, `crossesFailing`, `highLine`, `possessionSterile`, `xgGap`, `setPieceThreat`, `keeperBusy`, `momentumShift`, `tiredLegs`, `cardTrouble`, `midfieldBattle`, `longBallBypass`. So Nadia's analysis is a real hint about what the player could change.
- **New keys:** `ATMOSPHERE` (crowd and weather, at most every 8 minutes of play, never over action), `ANALYSIS` (replaces `COLOUR_ANALYSIS`), `PLAYER_STORY` (Nadia on a player's story, on his involvement in a big moment, at most once per player per match), `KNOCK` (§12.19).
- **Pacing:** one Callum line per event of importance ≥ 1; routine passing (`PASS_RUN`) at most once every 20 sim seconds. A great commentator leaves silence.
- **Length:** up to 120 characters (it was 90).
- **Minimum counts (v1.7):** GOAL 30 (most tagged), KICKOFF 12, ANALYSIS 24, PLAYER_STORY 13, ATMOSPHERE 8; every other key ≥ 2 untagged lines. The total is about 260.

### 16.2 Press (`press.json`)
```json
{ "questions": [ { "id": "pre_derby_01", "context": ["PRE_DERBY"], "text": "Big one against {opponent}. What does this derby mean to you?", "voText": "Big one this week. What does this derby mean to you?",
  "answers": [ { "id": "a", "tone": "Confident", "text": "We're going there to win. Simple.", "effects": { "fans": 3, "board": 0, "squadMorale": 2, "risk": "If we lose, fans −3 extra" } }, ... ] } ] }
```
Contexts: PRE_DERBY, POST_WIN, POST_BIG_WIN, POST_DRAW, POST_LOSS, POST_BIG_LOSS, POST_UPSET_WIN (beat a team with rep ≥ ours + 2), STREAK_WIN, STREAK_LOSS, PLAYER_PRAISE (MOTM rating ≥ 8.5), PLAYER_CRITICISM (a starter rated ≤ 5.5), TRANSFER_RUMOUR, OPENING_DAY. At least 4 questions per context (≥ 52 total), 3 answers each with effects on fans (−5..+5), board (−3..+3), squad morale (−4..+4) or one player's morale (−8..+8), plus optional conditional effects resolved on the next match (e.g. Confident → if lost next match, fans −3). `voText` has no tokens (voice audio uses it). **v1.7:** each answer also gets a `voText` (no tokens) for the coach's voice; its audio is `vo/coach/press_{questionId}_{answerId}.mp3`.
The journalist: 3 fictional journalists with names, outlets and portraits (`images/people/journalist_{1..3}.webp`), e.g. "Priya Natarajan, Meridian Sport", "Joe Kettering, The Saltmere Echo", "Femi Adebayo-Clarke, Coastline Radio".

### 16.3 Team talks (`talks.json`)
For each context × tone: 3 alternative manager lines (what the manager says, shown in a speech bubble) and 4 player reaction lines (positive, neutral, negative, mixed). 9 contexts × 6 tones × 3 = 162 manager lines minimum.
**v1.7 (voiced coach):** every manager line has an `id` and a `voText` with no tokens, as in §16.2 (`{ "id": "ht_lose_demand_02", "text": "...", "voText": "..." }`). If `text` has no tokens, `voText` may be left out and `text` is used. The half-time Demand and Disappointment lines are written to be shouted.
**The coach calls players by name (v1.7):** a coach line may have `"nameSlot": "start"` or `"end"` with exactly one `{player}` token at the very start or very end of `text` (`"{player}, I need more from you."`, `"That's the standard. Well done, {player}."`). The audio is chained like commentary (§16.1): `vo/coach_names/{playerId}.mp3` + the line, or the line + the name, with a 120 ms gap. The `voText` leaves the name out. The same rule applies to coach lines in §16.4 and §16.9. Lines that name a player are spoken to one player: the reaction (§14.11.2) and the face gaze go to him. In team talks, at least 1 of the 3 alternatives per context × tone names a player (the player is the context's natural pick: the MOTM, the worst rated, the captain, or the scorer).

### 16.4 Conversations (`conversations.json`)
Per §12.9: types `playing_time`, `contract`, `unhappy`, `praise`, each with ≥ 3 openings and 3 reply options with effects and follow-up lines. **v1.7:** the coach's reply options and the players' lines each get an `id` and a token-free `voText` (players are voiced if credits allow, §17.4).

### 16.5 Assistant (`assistant.json`)
Templates for §15.2–15.5: each rule id with ≥ 2 text variants and a reason line. Plus 30 generic remarks for idle moments in the Hub ("The squad looked sharp in training today").

### 16.6 News and back pages (`news.json`)
- **Match headlines** by result type (big win, win, late winner, draw, comeback, loss, heavy loss, derby win/loss, upset, hat-trick, clean sheet streak, red card story): ≥ 4 headlines each, punchy tabloid style with tokens ("{team} BLOW {opponent} AWAY", "LATE {player} STRIKE SINKS {opponent}"). Sub-headline and 2-sentence body templates.
- **Back page image**: `images/news/{clubId}_{scenario}.webp` with scenarios `celebration`, `dejection`, `manager`, `crowd` (40 images); fallback: a styled card with the crest and a halftone pattern.
- **Transfer news**, **injury news**, **board news**, **fan reactions** (short quotes with fictional fan names and towns), **inbox templates** (§12.11). ≥ 120 templates total.

### 16.7 Injuries (`injuries.json`)
≥ 20 kinds: `{ "id": "hamstring_strain", "name": "Hamstring strain", "severity": ["Minor","Moderate"] }`.

### 16.8 Writing guidelines (all content)
Tone: British/international football broadcast English, energetic but not cringe; no profanity; no real people, clubs or brands; vary sentence length; avoid repeated phrases; each line ≤ 120 characters (commentary ≤ 90).

### 16.9 Club life (`club.json`, v1.7)
Short lines with character (the user, 23 Nov: fewer, shorter, more personality). Each line has `id`, `speaker`, `set`, `text`, an optional `voText` (no tokens) and `mood`. Per moment, 1–2 variants (shouts 2, because they repeat in a match). The authoritative list is `tools/content/build_club.py`.
### 16.10 Content written by Claude (23 Nov)
Claude wrote `commentary.json`, `assistant.json`, `club.json` and `training.json` from the builders in `tools/content/` (edit the builder, not the JSON). Shapes:
- `commentary.json`: `{lines: [{id, key, voice, text, voText, nameSlot, intensity, tags?}]}`. `voText` is the line without the name, for `nameSlot: "start"` lines. Tags and keys are in §16.1 v1.7.
- `assistant.json`: `{rules: {ruleId: {variants[], reason}}, remarks[], stingers[], greetings[], halfTimeOpeners[], postMatchOpeners[]}`. Rule ids cover §15.2–15.5, §12.18.4 (`tw_*`), §13.20.9 (`sp_*`), §13.21 shouts (`im_shout_*`) and §13.22 (`im_plan_b`).
- `club.json`: `{lines: [{id, speaker, set, mood, text, voText, voiced, nameSlot?}]}`. Speakers are owner, coach, assistant, physio and player. Characters: Margaret Holloway (owner: plain-spoken, dry, no speeches), Theo Vance (old pro, dry wit), Sam Oduya (physio: blunt, medical). Lines are short on purpose (rewritten 23 Nov): one or two variants per moment. `set` names the moment: `welcome`, `review_happy`, `shout_pushForward`, `discipline_fine`, `knock_read`, `reply_fine_hot`, and so on.
- `training.json`: `{coachNotes: {signal: [{id, text}]}, oneToOne: [line as club.json], theoWeek: {rule: [{id, text}]}}`.

A line's audio path is `vo/<folder>/<id>.mp3` (§17.4). Names chain by `nameSlot` (§16.3).

