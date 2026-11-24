"""Writes src/content/squad_reactions.json (SPEC §14.11.2 v1.7) and the short `reactions` summaries in talks.json.

After a team talk the room reacts like a real dressing room: one player speaks (at most one voiced line, §11.25.5),
others react with a gesture. Sets are keyed by talk group x tone family x outcome (positive/negative/neutral/mixed).
Beat = (who, emotion, gesture, line|None). who: captain, veteran (31+), young (20 or under), hothead (Temperamental),
keeper, room (everyone not already reacting).
Run from the repo root: python tools/content/build_reactions.py
"""
import json
GROUPS = {'PRE': ['PRE_FAV', 'PRE_DOG', 'PRE_EVEN'], 'HT_WIN': ['HT_WIN'], 'HT_DRAW': ['HT_DRAW'], 'HT_LOSE': ['HT_LOSE'],
          'FT_WIN': ['FT_WIN'], 'FT_DRAW': ['FT_DRAW'], 'FT_LOSE': ['FT_LOSE']}
FAMILIES = {'hard': ['Demand', 'Disappoint'], 'lift': ['Motivate', 'Praise'], 'calm': ['Calm', 'Focus']}
S = {
'PRE': {
 'hard': {'positive': ("Jaws set. They're ready.", [('captain','defiant','StandUp',"Come on! You heard him!"), ('hothead','angry','SlapWall',None), ('room','defiant','Clap',None)]),
          'negative': ("Too much. The room's gone tight.", [('hothead','angry','ArmsFolded',"We know, gaffer. We know."), ('young','nervous','BounceLegs',None), ('veteran','cold','LookAway',None)])},
 'lift': {'positive': ("Buzzing. Studs drumming on the floor.", [('hothead','excited','FistPump',"Let's go, then!"), ('room','excited','Clap',None), ('young','happy','Nod',None)]),
          'negative': ("Polite nods. Nobody quite buys it.", [('captain','neutral','Nod',"Right. Yeah."), ('veteran','wry','Shrug',None), ('young','nervous','TieBoots',None)])},
 'calm': {'positive': ("Settled. Quiet, but switched on.", [('captain','warm','Nod',"Simple. We can do that."), ('keeper','neutral','Nod',None), ('young','warm','Sigh',None)]),
          'negative': ("Too flat. Somebody yawns.", [('captain','worried','StandUp',"Lads, wake up. Come on."), ('hothead','tired','Sigh',None), ('veteran','neutral','LookAway',None)])},
 'any': {'neutral': ("They listen. Nods. Studs on the floor.", [('captain','neutral','Nod',None), ('young','nervous','TieBoots',None)])}},
'HT_WIN': {
 'hard': {'positive': ("Nobody's relaxing now.", [('captain','defiant','StandUp',"He's right. It's not done."), ('hothead','angry','Nod',None), ('keeper','defiant','Clap',None)]),
          'negative': ("They think they've done nothing wrong.", [('hothead','angry','ShakeHead',"We're winning, gaffer!"), ('veteran','wry','LookAway',None), ('young','hurt','HeadDown',None)])},
 'lift': {'positive': ("Grins. They want another.", [('hothead','excited','FistPump',"Another one. Come on!"), ('room','happy','Clap',None), ('captain','happy','HugNeighbour',None)]),
          'negative': ("Too pleased with themselves.", [('veteran','worried','ShakeHead',"Careful. It's not over."), ('young','amused','Laugh',None), ('hothead','happy','Laugh',None)])},
 'calm': {'positive': ("Calm and sure. Same again.", [('captain','warm','Nod',"Same again, lads."), ('keeper','neutral','Nod',None), ('young','warm','Nod',None)]),
          'negative': ("Comfortable. Too comfortable.", [('veteran','wry','Shrug',"Easy, this."), ('hothead','tired','Sigh',None), ('young','neutral','LookAway',None)])},
 'any': {'neutral': ("Water bottles, nods, a few words.", [('room','neutral','Nod',None), ('keeper','tired','Sigh',None)])}},
'HT_DRAW': {
 'hard': {'positive': ("Stung. They're up and talking.", [('captain','angry','SlapWall',"Come on! We're better than this!"), ('hothead','defiant','StandUp',None), ('young','nervous','Nod',None)]),
          'negative': ("Shoulders drop. One answers back.", [('hothead','angry','KickBottle',"What do you want from us?"), ('young','hurt','HeadDown',None), ('veteran','cold','LookAway',None)])},
 'lift': {'positive': ("Belief. They can win this.", [('captain','excited','Clap',"Let's go and win it!"), ('room','defiant','Clap',None), ('young','happy','Nod',None)]),
          'negative': ("Nobody's sure what's changed.", [('captain','neutral','Nod',"Okay. Okay."), ('veteran','wry','Shrug',None), ('hothead','neutral','LookAway',None)])},
 'calm': {'positive': ("Clear heads. They know the job.", [('captain','warm','Nod',"We're fine. Keep going."), ('keeper','neutral','Nod',None), ('young','warm','Sigh',None)]),
          'negative': ("Too calm. Nobody's angry about it.", [('hothead','angry','ShakeHead',"That's it? That's the talk?"), ('veteran','tired','Sigh',None), ('young','nervous','BounceLegs',None)])},
 'any': {'neutral': ("Quiet. Bottles passed round.", [('room','neutral','Nod',None), ('hothead','tired','Sigh',None)])}},
'HT_LOSE': {
 'hard': {'positive': ("Fury. The good kind.", [('captain','angry','StandUp',"He's right! Look at us!"), ('hothead','angry','SlapWall',None), ('room','defiant','Clap',None)]),
          'negative': ("Some fire back. Some shrink.", [('hothead','angry','ThrowTowel',"We're trying, gaffer!"), ('young','hurt','TowelOverHead',None), ('veteran','cold','LookAway',None)])},
 'lift': {'positive': ("Chins up. They believe again.", [('captain','defiant','TapChest',"One goal. We've got this."), ('room','defiant','Clap',None), ('young','warm','Nod',None)]),
          'negative': ("Nobody buys it. They're losing.", [('veteran','cold','ShakeHead',"Played well? We're losing."), ('hothead','angry','LookAway',None), ('young','sad','HeadDown',None)])},
 'calm': {'positive': ("Breathing again. Heads clear.", [('keeper','warm','Nod',"Okay. Nobody panic."), ('captain','neutral','Nod',None), ('young','warm','Sigh',None)]),
          'negative': ("They wanted fire. They got a cuddle.", [('veteran','cold','ArmsFolded',"That's all, is it?"), ('hothead','angry','ShakeHead',None), ('captain','worried','HandsOnHead',None)])},
 'any': {'neutral': ("Silence. Long stares at the floor.", [('room','sad','HeadDown',None), ('captain','worried','HandsOnHead',None)])}},
'FT_WIN': {
 'hard': {'positive': ("Nobody's celebrating. Good.", [('captain','neutral','Nod',"Fair. We were sloppy."), ('veteran','neutral','Nod',None), ('young','worried','HeadDown',None)]),
          'negative': ("They won. They wanted a smile.", [('hothead','angry','KickBottle',"We just won, gaffer!"), ('young','hurt','LookAway',None), ('veteran','wry','Shrug',None)])},
 'lift': {'positive': ("Music on. Somebody's dancing.", [('hothead','excited','FistPump',"Get in! Get in!"), ('room','happy','HugNeighbour',None), ('young','happy','Laugh',None)]),
          'negative': ("Some think it was a bit lucky.", [('veteran','wry','Shrug',"It wasn't that good, gaffer."), ('captain','neutral','Nod',None), ('young','happy','Laugh',None)])},
 'calm': {'positive': ("Happy, tired, quiet.", [('captain','warm','Clap',"Good shift, lads."), ('keeper','tired','Sigh',None), ('young','happy','Nod',None)]),
          'negative': ("Flat, for a win.", [('young','neutral','Shrug',"Is that it?"), ('room','tired','Sigh',None), ('hothead','neutral','LookAway',None)])},
 'any': {'neutral': ("Boots off. Small smiles.", [('room','warm','Nod',None), ('young','happy','Laugh',None)])}},
'FT_DRAW': {
 'hard': {'positive': ("They know it. Two points dropped.", [('captain','angry','SlapWall',"He's right. Should've won that."), ('hothead','defiant','Nod',None), ('young','worried','HeadDown',None)]),
          'negative': ("They think a point was fair.", [('hothead','angry','ShakeHead',"A point's not nothing, gaffer."), ('veteran','cold','ArmsFolded',None), ('young','hurt','HeadDown',None)])},
 'lift': {'positive': ("Gutted, but up for next week.", [('captain','defiant','TapChest',"Next week. We win it."), ('room','defiant','Clap',None), ('young','warm','Nod',None)]),
          'negative': ("A draw's a draw. Nobody's lifted.", [('veteran','tired','Sigh',"It's a draw, gaffer."), ('hothead','neutral','LookAway',None), ('captain','neutral','Nod',None)])},
 'calm': {'positive': ("Tired. Fair enough.", [('keeper','warm','Nod',"Point's a point."), ('room','tired','Sigh',None), ('captain','neutral','Nod',None)]),
          'negative': ("Too relaxed about it.", [('hothead','angry','ShakeHead',"We should be fuming."), ('veteran','tired','Sigh',None), ('young','neutral','LookAway',None)])},
 'any': {'neutral': ("Ice packs. Not much said.", [('room','tired','Sigh',None), ('keeper','neutral','Nod',None)])}},
'FT_LOSE': {
 'hard': {'positive': ("Silent. Taking it. They'll answer it.", [('captain','hurt','Nod',"We deserved that."), ('hothead','angry','KickBottle',None), ('young','sad','TowelOverHead',None)]),
          'negative': ("The room turns on itself.", [('hothead','angry','StandUp',"Don't put it all on us!"), ('veteran','cold','ArmsFolded',None), ('young','sad','TowelOverHead',None)])},
 'lift': {'positive': ("Heads come up, slowly.", [('captain','defiant','StandUp',"Next week. Remember this."), ('room','defiant','Clap',None), ('young','sad','Nod',None)]),
          'negative': ("Praise, after that? Nobody looks up.", [('veteran','cold','LookAway',"Don't. We were rubbish."), ('young','sad','HeadDown',None), ('hothead','angry','ShakeHead',None)])},
 'calm': {'positive': ("Hurting, but steady.", [('captain','sad','Nod',"Yeah. We go again."), ('keeper','tired','Sigh',None), ('young','sad','HeadDown',None)]),
          'negative': ("They wanted somebody to be angry.", [('hothead','angry','ThrowTowel',"That's it? Nothing?"), ('captain','worried','HandsOnHead',None), ('veteran','tired','Sigh',None)])},
 'any': {'neutral': ("Nobody speaks. Boots come off slowly.", [('room','sad','HeadDown',None), ('captain','tired','Sigh',None)])}},
}
MIXED = {'PR': "Split. Half fired up, half nervous.", 'HT': "Split. Some fired up, some sulking.", 'FT': "Split. Some nod. Some won't look at you."}
VOICE = {'young': 'player1', 'captain': 'player2', 'veteran': 'player2', 'keeper': 'player2', 'hothead': 'player3', 'room': 'player2'}
emo = json.load(open('src/content/emotions.json', encoding='utf-8'))


def beats(group, fam, out, lst):
    res = []
    for who, e, g, line in lst:
        assert e in emo['emotions'] and g in emo['gestures'], (e, g)
        b = {'who': who, 'emotion': e, 'gesture': g}
        if line:
            assert len(line) <= 40, line
            b.update(id=f'react_{group}_{fam}_{out}'.lower(), line=line, voice=VOICE[who])
        res.append(b)
    assert sum('line' in b for b in res) <= 1
    return res


sets = {}
for group, fams in S.items():
    sets[group] = {}
    for fam, outs in fams.items():
        sets[group][fam] = {o: {'summary': s, 'beats': beats(group, fam, o, b)} for o, (s, b) in outs.items()}
    for fam in FAMILIES:  # mixed = the positive voiced beat + the negative silent beats
        pos, neg = sets[group][fam]['positive']['beats'], sets[group][fam]['negative']['beats']
        sets[group][fam]['mixed'] = {'summary': MIXED[group[:2]], 'beats': [pos[0]] + [b for b in neg if 'line' not in b][:2]}
out = {'_note': 'SPEC §14.11.2 v1.7. Written by tools/content/build_reactions.py; do not edit by hand.',
       'groups': GROUPS, 'families': FAMILIES, 'sets': sets}
json.dump(out, open('src/content/squad_reactions.json', 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=2)
t = json.load(open('src/content/talks.json', encoding='utf-8'))
for group, ctxs in GROUPS.items():
    for ctx in ctxs:
        for fam, tones in FAMILIES.items():
            for tone in tones:
                t[ctx][tone]['reactions'] = {o: sets[group][fam][o]['summary'] if o != 'neutral' else sets[group]['any']['neutral']['summary']
                                             for o in ('positive', 'neutral', 'negative', 'mixed')}
json.dump(t, open('src/content/talks.json', 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=2)
L = {b['id']: b['line'] for g in sets.values() for f in g.values() for o in f.values() for b in o['beats'] if 'line' in b}
print(len(L), 'voiced reaction lines,', sum(len(x) for x in L.values()), 'chars')
