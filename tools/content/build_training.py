"""Writes src/content/training.json (SPEC §12.18.8, §12.18.10)."""
import json, sys, re
notes = {
 'rating_up': ["Sharper on the ball this month.","Training like a man who wants a shirt.","Best week he's had in a while.","Flying in the small-sided games."],
 'rating_down': ["Going through the motions.","Struggling with the pace of training.","His head isn't fully here this week.","Needs a lift. Something's off."],
 'growth': ["Ready for more minutes.","Making real progress. You can see it.","The focus work is paying off.","Looks a level up from August."],
 'condition_low': ["Running on empty. Needs a lighter week.","Tired legs. Watch his minutes.","Body's telling him to slow down."],
 'workload_heavy': ["Handling the extra work well.","The extra sessions are starting to show.","Keen, but don't burn him out."],
 'young': ["Learning fast. Listens, asks questions.","Raw, but the talent is obvious.","Mentoring is helping. Calmer on the ball."],
 'veteran': ["Still the standard-setter in training.","Knows his body. Trust him on rest days.","Leads the warm-up without being asked."],
}
coach_lines = {
 'technique': ["Stay out with me. Body shape when they run at you.","Ten minutes on your first touch. Then we go again.","{player}, we're working on your weaker foot today."],
 'confidence': ["You're starting games because you've earned it.","Forget last week. You're one of my best players.","I believe in you, {player}. Now play like it."],
 'fitness': ["Ice bath, then the bike. You'll need legs on Saturday.","Easy session for you. Recover properly.","Let's get your legs back, {player}."],
 'video': ["Look at the second goal. Where should you be?","Watch this run. You can do that every game.","Pause it there. See the space, {player}?"],
}
player_replies = {
 'technique': [("happy","Cheers, boss. I'll stay as long as it takes."),("neutral","Okay. Show me."),("worried","I'll try. It's not natural yet.")],
 'confidence': [("happy","That means a lot, boss."),("neutral","Thanks. I'll keep going."),("worried","I hope so. It's been a tough few weeks.")],
 'fitness': [("happy","Thank God. My legs are gone."),("neutral","Fine by me."),("worried","I'd rather train, boss, but okay.")],
 'video': [("happy","I see it. I'll be there next time."),("neutral","Yeah. I was ball-watching."),("worried","I didn't realise it was that bad.")],
}
theo_week = {
 'recovery_swap': ["Too many tired legs. I've swapped the hard sessions for recovery.","{player} and two others are over 50 fatigue. Recovery in."],
 'shape_work': ["They're not sharp on the system yet. Shape work on Thursday.","Familiarity is low. One more shape session will help."],
 'opponent_prep': ["Friday is for {opponent}. I've a plan for how they play.","Opponent prep on Friday. They have a clear pattern."],
 'set_pieces': ["Their big man wins everything. Corners on Thursday.","Set-piece practice. Their threat in the air worries me."],
}
def entry(i, speaker, set_, mood, t):
    slot = 'start' if t.startswith('{player}') else 'end' if re.search(r'\{player\}[.?!]?$', t) else 'none'
    vo = t[len('{player}'):].lstrip(' ,.') if slot == 'start' else re.sub(r',?\s*\{player\}([.?!]?)$', r'\1', t) if slot == 'end' else t
    e = {'id': f'{speaker}_{set_}_{i:02d}', 'speaker': speaker, 'set': set_, 'mood': mood, 'text': t, 'voText': vo[:1].upper() + vo[1:]}
    if slot != 'none': e['nameSlot'] = slot
    return e
oto = []
for k, arr in coach_lines.items():
    oto += [entry(i, 'coach', f'oto_{k}', 'neutral', t) for i, t in enumerate(arr, 1)]
for k, arr in player_replies.items():
    oto += [entry(i, 'player', f'oto_reply_{k}', m, t) for i, (m, t) in enumerate(arr, 1)]
data = {'coachNotes': {k: [{'id': f'note_{k}_{i:02d}', 'text': t} for i, t in enumerate(v, 1)] for k, v in notes.items()},
        'oneToOne': oto,
        'theoWeek': {k: [{'id': f'tw_{k}_{i:02d}', 'text': t} for i, t in enumerate(v, 1)] for k, v in theo_week.items()}}
json.dump(data, open(sys.argv[1], 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=2)
print(sum(len(v) for v in notes.values()), 'notes,', len(oto), 'one-to-one lines; voiced chars', sum(len(e['voText']) for e in oto))
