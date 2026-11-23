"""Rewrites the manager lines in src/content/talks.json (ids, structure and effects unchanged).
Short, direct, in the coach's voice. One line per context x tone names a player (start or end).
"""
import json, re, sys
T = {
'PRE_FAV': {
 'Calm': ["We're better than them. Prove it slowly.","No rush. The goals will come.","{player}, set the tempo. Everyone follows you."],
 'Motivate': ["Favourites is just a word. Go and earn it.","Make them wish they'd stayed on the bus.","Big game from you today, {player}."],
 'Demand': ["Anything less than three points is a failure.","No lazy passes. No lazy runs. Nothing.","I want a clean sheet from you, {player}."],
 'Praise': ["You've earned the right to be favourites. Enjoy it.","Best squad this club's had in years. Show them.","Keep playing like you are, {player}."],
 'Disappoint': ["Last week wasn't good enough. Don't repeat it.","I've watched you play down to teams like this. Not today.","You switched off last time, {player}. Not today."],
 'Focus': ["First ten minutes. Win them.","Do your job. Just your job.","Stay on your man all game, {player}."],
},
'PRE_DOG': {
 'Calm': ["Nobody expects anything from us. That's freedom.","Stay in the game. The chance will come.","Keep it simple today, {player}."],
 'Motivate': ["They think it's already won. Let's ruin their day.","Giants fall. Go and push one.","This is your stage, {player}."],
 'Demand': ["Run until it hurts. Then run again.","If we lose, they'll know they were in a game.","I need ninety minutes from you, {player}."],
 'Praise': ["You've worked for this. Go and enjoy it.","Every one of you deserves to be out there.","Proud of you already, {player}."],
 'Disappoint': ["We were timid last time. I won't watch that again.","They bullied us last time. Never again.","You hid last time, {player}. Don't."],
 'Focus': ["Two banks of four. Compact. Patient.","Set pieces. That's our chance.","He's their danger. Stay on him, {player}."],
},
'PRE_EVEN': {
 'Calm': ["Even game. Small details decide it.","Stay patient. It'll open up.","Steady hands today, {player}."],
 'Motivate': ["Fifty-fifty. Make it sixty-forty.","Somebody wins the battles. Make it us.","Big moment for you, {player}. Take it."],
 'Demand': ["Every second ball is ours. Every single one.","Win your duel. That's all I ask.","I want you everywhere today, {player}."],
 'Praise': ["You've earned this run. Keep it going.","Training was sharp. Take it out there.","Brilliant week, {player}. Keep it up."],
 'Disappoint': ["We dropped points we shouldn't have. Make up for it.","Last week was soft. Not today.","You were off it last week, {player}."],
 'Focus': ["Concentration. Ninety minutes of it.","Shape. Shape. Shape.","Stay in your lane, {player}."],
},
'HT_WIN': {
 'Calm': ["Good half. Same again.","Keep the ball. Let them chase it.","Keep doing exactly that, {player}."],
 'Motivate': ["One more and it's done. Go and get it.","They're there for the taking. Finish it.","Another one for you, {player}?"],
 'Demand': ["One-nil is nothing. Don't you dare relax.","We've been lucky. Wake up.","Tighter at the back, {player}."],
 'Praise': ["Brilliant. Best half we've played.","That's exactly what I asked for.","Different class, {player}."],
 'Disappoint': ["We're winning and I'm still not happy.","We're ahead in spite of ourselves.","You've given it away all half, {player}."],
 'Focus': ["Next goal decides it. Make it ours.","Same shape. Same work.","Stay switched on, {player}."],
},
'HT_DRAW': {
 'Calm': ["It's level. We're fine. Keep going.","Nothing's changed. Trust the plan.","Keep doing your job, {player}."],
 'Motivate': ["This is there for us. Go and take it.","Forty-five minutes. Make them count.","Win it for us, {player}."],
 'Demand': ["Level isn't good enough. More.","We're letting them off the hook.","I need more from you, {player}."],
 'Praise': ["Good effort. Now add a goal.","You're the better side. Keep at it.","Unlucky not to score, {player}."],
 'Disappoint': ["That was flat. Where's the hunger?","Too many passengers out there.","You've gone missing, {player}."],
 'Focus': ["One chance. That's all it takes. Be ready.","Keep the shape. The goal will come.","Be in that box, {player}."],
},
'HT_LOSE': {
 'Calm': ["One goal. That's all. Plenty of time.","Breathe. We know how to fix this.","Keep your head, {player}."],
 'Motivate': ["Forty-five minutes to change this. Go.","Nobody leaves this pitch without a fight.","Go and turn it around, {player}."],
 'Demand': ["That was soft. Every one of you. Soft.","Look at me. That's not good enough. Not close.","{player}! Look at me! Show some pride!"],
 'Praise': ["We've played well. Keep going.","The goal's coming. I can feel it.","Best man out there, {player}."],
 'Disappoint': ["I'm embarrassed. That wasn't us.","Worst half I've seen from you lot.","You've let them run past you, {player}."],
 'Focus': ["One goal first. Then we see.","Get it wide. Get crosses in.","Get on the ball, {player}."],
},
'FT_WIN': {
 'Calm': ["Good. Rest up. Next one.","Three points. Enjoy it tonight.","Well played, {player}. Rest up."],
 'Motivate': ["That's the standard now. Keep it.","Get used to this feeling.","More of that next week, {player}."],
 'Demand': ["We won, but we were sloppy. Fix it.","Don't believe the papers. We're not there yet.","Good, but I want more from you, {player}."],
 'Praise': ["Brilliant. Every single one of you.","That's what this club is about.","Outstanding, {player}. Proud of you."],
 'Disappoint': ["We won ugly. I don't want ugly.","Three points, but that was poor.","You coasted, {player}. Don't."],
 'Focus': ["Recovery tonight. Next game in six days.","Forget it now. Next one.","Look after yourself this week, {player}."],
},
'FT_DRAW': {
 'Calm': ["A point. We'll take it.","Not a disaster. We move on.","Decent shift, {player}."],
 'Motivate': ["We were close. Next week, we win it.","Take the anger into the next one.","Next week's yours, {player}."],
 'Demand': ["Two points dropped. Every one of you knows it.","That should've been a win.","You need to finish those, {player}."],
 'Praise': ["Good point against a good side.","Hard work today. I'm happy.","You never stopped running, {player}."],
 'Disappoint': ["That was flat. Really flat.","We didn't deserve more.","Not good enough today, {player}."],
 'Focus': ["Review it tomorrow. Then forget it.","Little things. We'll fix them.","We'll work on your finishing, {player}."],
},
'FT_LOSE': {
 'Calm': ["One bad day. We go again.","Heads up. It's one game.","Head up, {player}. It happens."],
 'Motivate': ["Remember this feeling. Use it.","Next week, somebody pays for this.","Bounce back for me, {player}."],
 'Demand': ["Unacceptable. All of it.","That was a disgrace, and you know it.","You were nowhere today, {player}."],
 'Praise': ["You gave everything. That's all I ask.","We were unlucky. Keep your heads up.","Nothing more you could have done, {player}."],
 'Disappoint': ["I'm not angry. I'm disappointed. That's worse.","That's not the team I know.","I expected more from you, {player}."],
 'Focus': ["We learn from it. Video on Monday.","Fix the basics. That's all.","We'll work on it this week, {player}."],
},
}
def vo(t):
    if t.startswith('{player}'):
        b = t[len('{player}'):].lstrip(' ,!.'); return b[:1].upper() + b[1:], 'start'
    if re.search(r'\{player\}[.?!]?$', t) or re.search(r'\{player\}\. [^{]*$', t):
        b = re.sub(r',?\s*\{player\}', '', t); return b, 'end'
    return t, None
p = sys.argv[1]
d = json.load(open(p, encoding='utf-8'))
for ctx, tones in T.items():
    for tone, lines in tones.items():
        ml = d[ctx][tone]['managerLines']
        assert len(ml) == len(lines), (ctx, tone)
        for e, t in zip(ml, lines):
            v, slot = vo(t)
            assert '{' not in v, t
            e['text'] = t; e['voText'] = v
            if slot: e['nameSlot'] = slot
            else: e.pop('nameSlot', None)
json.dump(d, open(p, 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=2)
L = [l['voText'] for c in d.values() for t in c.values() for l in t['managerLines']]
print(len(L), 'lines,', sum(map(len, L)), 'voiced chars')
