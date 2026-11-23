# Week Summary reference (approved by the user, 23 Nov)

`week-summary.png` is the target; `index.html` is its static source. Build Week Summary (§11.19) to match it. It's an on-air screen, **"The Round-Up"**: a weekend football show, with the local paper's back page laid on top. Where this file and §11.19 differ, this file wins on layout and look.

## Layout (1920×1080; fits 1280×720 with no scroll)
- **Kicker:** a `THE ROUND-UP` chip, then league · matchday · "weekend of {date}". A faint giant matchday numeral watermarks the background, which is deep navy with diagonal hairlines and a faint glow in the club accent.
- **The local paper's back page** (left, spanning two columns, tilted −0.7°, on newsprint `--newsprint` with `--news-ink`):
  - **Masthead:** the user's **hometown paper** (see below) in Playfair Display 900; date, issue number and price; a black `SPORT` tab.
  - **Kicker:** league · matchday, in red.
  - **Headline:** Barlow Condensed 800, about 60 px, tabloid style, from `news.json` round headlines. It picks the round's biggest story **for the user**: a title-race change, a relegation swing, a derby, a streak, or their own result.
  - **Standfirst:** Source Serif 4 600.
  - **Byline:** the paper's reporter · venue.
  - **Article:** two justified serif columns with a drop cap; 3–4 sentences from templates, including one player quote.
  - **Press photo:** a frame from the user's actual match at the key moment (the goal, the save, the red card), rendered to a halftone in news ink (§18.5 print style), with an italic caption.
  - A faint fold line and paper texture.
- **The results:** a broadcast strip per fixture, with club-colour edge bars, a warm off-white score block, and scorers under each name. The user's match is first, with an accent outline, an accent score block and a `YOUR MATCH` tag.
- **The table:**
  - Position, movement (▲n green / ▼n red / –), club with its colour bar, GD, points, and last-5 form squares.
  - The user's row has an accent gradient and a left bar.
  - Dashed lines mark the target zone (accent) and the danger zone (red).
  - Rows **slide** to their new positions on entry (FlipList, §19.7).
- **Your week** (right):
  - **Board confidence and Fans:** the value, the change, a meter, and the **reason** (from the §12.7 and §12.14 deltas).
  - **Medical:** injuries, returns, and the outcomes of §12.19 decisions.
  - **Training:** the top improvers, trait or position progress, and the biggest rating drop (§12.18.8).
  - **"Needs you before Saturday":** the actionable items (conversations, incidents, contract talks, bids), each with a button. Continue is blocked until the blocking ones are handled (§10.1).
  - **The money:** gate, TV and sponsor, wages and running costs, balance.
- **Foot:**
  - **Next:** the next fixture card (opponent, H/A, day, slot, their position and form).
  - **Continue** (`Space`).
  - **Ticker:** Golden Boot, streaks, rumours, sackings.

## Local papers: one per club town, used everywhere print appears
The user's club's paper is the masthead on Week Summary, the Hub newspaper panel, the back page after a match (§11.18 step 4) and news items. Rival papers appear in the ticker ("The Saltmere Echo says…").

| Club town | Paper | Reporter (byline) |
|---|---|---|
| Port Calloway | The Calloway Gazette | Joe Kettering |
| Ironvale | Ironvale Evening Post | Dana Whitcombe |
| Kestrel Bay | The Bay Herald | Femi Adebayo-Clarke |
| Saltmere | The Saltmere Echo | Priya Natarajan |
| Brightwater | The Brightwater Lamp | Callum Reid |
| Northgate | Northgate Chronicle | Sofia Lindqvist |
| Ashcombe | Ashcombe Advertiser | Tom Harrow |
| Veldmoor | The Moorland Mercury | Agnes Penhale |
| Lindenfield | Lindenfield Times | Marco Ferri |
| Corvallen | The Corvallen Courier | Ruth Okonkwo |

Put these in `content/news.json` as `papers`, keyed by club id. The §16.2 press journalists keep their outlets for press conferences.

## Motion
1. The paper drops in and settles (spring, `ui_paper`).
2. The results tick in 80 ms apart.
3. The table rows slide to their new places.
4. The meters ease.

Reduce motion: everything at rest.
