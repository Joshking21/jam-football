"""Rewrites src/content/conversations.json: short player openings and reactions, short coach replies.
Ids, tones, moraleDelta and promise unchanged. Coach replies may name the player at the start or end."""
import json, re, sys
C = {
# opening id: (opening, [(reply a, reaction a), (b), (c)])
'conv_playtime_open_01': ("Boss. I came here to play, not to sit on the bench.", [
  ("{player}, you'll start. You have my word.", "That's all I wanted. I won't let you down."),
  ("You haven't earned it yet. Show me in training.", "Fine. Watch me, then."),
  ("If you're not happy, I'll find you a move.", "Then do it. I need a fresh start.")]),
'conv_playtime_open_02': ("Gaffer, I'm twenty-nine. I can't keep sitting out.", [
  ("Be patient. Your chance is coming soon.", "Alright. I'll trust you. Don't make me wait long."),
  ("Nobody's guaranteed a shirt here, {player}.", "I get that. But I've got a career too."),
  ("Don't want to fight for it? We'll listen to offers.", "If that's how you see it, tell the board.")]),
'conv_playtime_open_03': ("Can I ask why I've been dropped? Nobody's told me.", [
  ("I was resting you. You start this weekend, {player}.", "Good. I'll be ready."),
  ("Different games need different players. Stay ready.", "Fair. Just keep me in your plans."),
  ("{player}, you're not in my plans. Let's part ways.", "At least you're honest. I'll call my agent.")]),
'conv_contract_open_01': ("One year left, boss. I want to stay. Can we talk?", [
  ("You've earned it. Let's get it signed, {player}.", "Brilliant. This is home."),
  ("Not now. We'll talk at the end of the season.", "Don't leave it too late, boss."),
  ("We can't offer more right now. I'm sorry.", "Then I'll look elsewhere.")]),
'conv_contract_open_02': ("My agent's asking where I stand, gaffer.", [
  ("New deal. Better terms. It's on the table.", "Thank you. Now I can just play."),
  ("{player}, I need to see the budget first.", "I can wait. My agent won't, though."),
  ("We won't renew. You're free to talk to clubs.", "Clear enough. Thanks for telling me straight.")]),
'conv_contract_open_03': ("Other clubs are watching, boss. I want to stay, but I want a raise.", [
  ("Ignore the noise. You'll get what you deserve, {player}.", "That's all I needed. I'm staying."),
  ("Don't use other clubs to push me.", "It's not a threat, boss. It's my family."),
  ("{player}, want to leave? Bring me an offer.", "Fine. We'll bring you one.")]),
'conv_unhappy_open_01': ("Boss, honestly? My head's not right. I'm struggling.", [
  ("{player}, I back you. Completely.", "Thanks, boss. That helps."),
  ("Tough spell for all of us. Chin up.", "Right. Head down, keep going."),
  ("Stop sulking. We've got games to win, {player}.", "Then I don't see a future here.")]),
'conv_unhappy_open_02': ("Gaffer, the mood here is dragging me down.", [
  ("I hear you. I'm fixing it. Stay with me.", "Thanks for listening. I'll do my bit."),
  ("Tough times show who you are, {player}.", "Point taken."),
  ("No stomach for it? I'll find someone who has.", "Don't question me. Sell me if you want.")]),
'conv_unhappy_open_03': ("I don't feel wanted here anymore. I'm done pretending.", [
  ("You're a leader here. I need you, {player}.", "That means a lot, boss."),
  ("{player}, my door's open. Let's sort it.", "Thanks, gaffer. This week, then."),
  ("You're paid to perform. Save the excuses.", "That tells me everything.")]),
'conv_praise_open_01': ("You wanted me, gaffer?", [
  ("{player}, you're carrying this team. Brilliant.", "Cheers, boss. Loving it right now."),
  ("Good form. Don't get comfortable.", "Feet on the ground. Promise."),
  ("There's another gear in you. Find it, {player}.", "Challenge accepted.")]),
'conv_praise_open_02': ("Morning, boss. Everything alright?", [
  ("Just wanted to say: world-class lately.", "From you? That means everything."),
  ("{player}, you're setting the standard here.", "Just leading by example, gaffer."),
  ("Don't stop now. Be our player of the season.", "That's the plan, boss.")]),
'conv_praise_open_03': ("Theo said you wanted a word?", [
  ("Sit down. The staff are proud of you. So am I.", "Thanks, gaffer. We're flying."),
  ("It's working. Keep that discipline, {player}.", "Locked in, boss."),
  ("{player}, show their fans who's best.", "Count on me.")]),
}
def vo(t):
    if t.startswith('{player}'):
        b = t[len('{player}'):].lstrip(' ,!.'); return b[:1].upper() + b[1:], 'start'
    if re.search(r'\{player\}[.?!]?$', t):
        return re.sub(r',?\s*\{player\}', '', t), 'end'
    return t, None
p = sys.argv[1]
d = json.load(open(p, encoding='utf-8'))
seen = 0
for k, v in d.items():
    for o in v['openings']:
        op, reps = C[o['id']]; seen += 1
        assert '{' not in op
        o['text'] = op; o['voText'] = op
        assert len(o['replies']) == len(reps), o['id']
        for r, (t, react) in zip(o['replies'], reps):
            v2, slot = vo(t); assert '{' not in v2, t
            r['text'] = t; r['voText'] = v2; r['playerReaction'] = react
            if slot: r['nameSlot'] = slot
            else: r.pop('nameSlot', None)
assert seen == len(C)
json.dump(d, open(p, 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=2)
O = [o for v in d.values() for o in v['openings']]
print(len(O), 'openings;', sum(len(o['voText']) + sum(len(r['voText']) + len(r['playerReaction']) for r in o['replies']) for o in O), 'voiced chars')
