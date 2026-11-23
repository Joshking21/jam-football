"""Writes src/content/club.json (SPEC §16.9 v1.7, rewritten 23 Nov: fewer, shorter lines with character).

Characters:
- Margaret Holloway (owner): plain-spoken, dry, hates speeches, never raises her voice.
- Theo Vance (assistant): old pro, dry wit, calls you gaffer, always half a step ahead.
- Sam Oduya (physio): blunt, medical, no drama.
- The coach (you): short, direct.
"""
import json, sys, re
OUT = []
def L(speaker, set_, mood, texts, voiced=True):
    for i, t in enumerate(texts, 1):
        slot = 'start' if t.startswith('{player}') else 'end' if re.search(r'\{player\}[.?!]?$', t) else 'none'
        vo = t[len('{player}'):].lstrip(' ,.…') if slot == 'start' else re.sub(r',?\s*\{player\}([.?!]?)$', r'\1', t) if slot == 'end' else t
        assert '{' not in vo, (set_, t)
        e = {'id': f'{speaker}_{set_}_{i:02d}', 'speaker': speaker, 'set': set_, 'mood': mood, 'text': t, 'voText': vo[:1].upper() + vo[1:], 'voiced': voiced}
        if slot != 'none': e['nameSlot'] = slot
        OUT.append(e)
# ---------------- Margaret Holloway, owner ----------------
L('owner','welcome','neutral',["Sit down. I don't do speeches."])
L('owner','offer_close','neutral',["Those are the terms. Yes or no?"])
L('owner','review_happy','happy',["Good. Keep it boring.","The town's talking again. I like that."])
L('owner','review_neutral','neutral',["Fine isn't the same as good.","We're watching. That's all."])
L('owner','review_worried','worried',["I don't like where this is going.","Fix it. Soon."])
L('owner','budget_granted','happy',["You've earned it. Don't waste it."])
L('owner','budget_refused','neutral',["Win something first."])
L('owner','sacking','angry',["I'm sorry. It's over.","We're making a change. Today."])
L('owner','verdict_great','happy',["You gave this town a season. Thank you."])
L('owner','verdict_ok','neutral',["A start. Next year, more."])
L('owner','verdict_poor','worried',["Not good enough. You know that."])
# ---------------- the coach ----------------
L('coach','walk_in','neutral',["Right. Listen in.","Eyes on me.","Sit down, lads."])
L('coach','briefing_mentality','neutral',["We go at them. From the first whistle.","Patient today. Let them come."])
L('coach','briefing_press','neutral',["Press high. They hate the ball.","Sit in. Stay compact. Pick them off."])
L('coach','briefing_key_battle','neutral',["Their winger's quick. Stay on your feet, {player}.","That's the game. Win your battle, {player}."])
L('coach','briefing_set_pieces','neutral',["Corners: big men far post. Like we practised.","Their corners are dangerous. Pick up a man."])
L('coach','briefing_width','neutral',["Stay wide. Stretch them.","Narrow. Make them go round us."])
L('coach','shout_pushForward','neutral',["Up! Get up the pitch!","Go on, push!"])
L('coach','shout_keepTight','neutral',["Tight! Hold your shape!","Compact! Nothing through!"])
L('coach','shout_getStuckIn','angry',["Get stuck in!","Win it! Get in there!"])
L('coach','shout_calmDown','neutral',["Calm down! Stay on your feet!","Heads! Keep your heads!"])
L('coach','shout_concentrate','neutral',["Switch on! Every ball!","Focus! Nearly there!"])
L('coach','shout_encourage','happy',["That's it! Keep going!","Lovely! More of that!"])
L('coach','shout_demandMore','angry',["Not good enough!","More! Come on!"])
L('coach','accept_job','happy',["I'm in."])
L('coach','discipline_fine','neutral',["A week's wages. Don't make me do it again."])
L('coach','discipline_drop','neutral',["You're not in the squad Saturday."])
L('coach','discipline_warn','neutral',["That's your warning. Your only one."])
L('coach','discipline_let_go','neutral',["Forget it. Once."])
L('coach','discipline_answer_public','angry',["Nobody's bigger than this club."])
L('coach','discipline_talk_private','neutral',["My office. After training."])
L('coach','discipline_side_senior','neutral',["He's right. Apologise, {player}."])
L('coach','discipline_team_meeting','neutral',["Both of you. Middle of the room. Now."])
L('coach','injury_take_off','neutral',["Get him off."])
L('coach','injury_carry_on','neutral',["He stays on."])
L('coach','injury_rush_yes','neutral',["He plays."])
L('coach','injury_rush_wait','neutral',["Another week. I'm not losing him."])
L('coach','warmup_start','neutral',["He starts. Watch him."])
L('coach','warmup_leave_out','neutral',["Leave him out."])
# ---------------- Theo Vance, assistant ----------------
L('assistant','welcome_after_job','happy',["Theo Vance. Eight years here, three managers. Let's make you the last one."])
L('assistant','knock_enter','neutral',["Got a minute, gaffer?","Gaffer. Bit of news."])
L('assistant','whiteboard','neutral',["Look. There. That's the gap.","Their full-back never tracks back. Never.","On that side, I'd put {player}."])
L('assistant','touchline_whisper','neutral',["Gaffer. Their left side.","Their nine's blowing. Push up.","We're getting overrun in the middle."])
L('assistant','talk_opener_pre','neutral',["They're ready, gaffer.","Quiet lot today. Wake them up."])
L('assistant','talk_opener_ht','neutral',["They're rattled, not beaten.","We're better than this, and they know it."])
L('assistant','talk_opener_ft','neutral',["All yours, gaffer.","Heads are down."])
L('assistant','incident_open_late','worried',["{player} was late again. Twenty minutes."])
L('assistant','incident_open_sent_off','worried',["That red card. Everyone's waiting to see what you do."])
L('assistant','incident_open_press','worried',["{player} has been talking to the papers. It's not pretty."])
L('assistant','incident_open_bustup','worried',["Bit of a dust-up in training. Two of them."])
L('assistant','incident_advice_late','neutral',["Once is a mistake. Twice is a habit."])
L('assistant','incident_advice_sent_off','neutral',["He cost us. A fine would be fair."])
L('assistant','incident_advice_press','neutral',["Go public and you lose him. Talk first."])
L('assistant','incident_advice_bustup','neutral',["Clear the air. All of them."])
# ---------------- Sam Oduya, physio ----------------
L('physio','knock_read','neutral',["He can carry on. He's not right, though.","It's a knock. It'll hurt. He'll live."])
L('physio','rush_offer','neutral',["He's close. We could risk him.","He says he's ready. His hamstring hasn't decided."])
L('physio','warmup_scare','worried',["{player}'s hamstring is tight. Your call.","{player} felt something in the warm-up."])
L('physio','outcome_good','happy',["Came through it. No reaction."])
L('physio','outcome_bad','worried',["It's gone again. Longer this time."])
# ---------------- players: replies to discipline (calm / hot-headed), one each ----------------
for choice, calm, hot in [
 ('fine',"Fair enough. Won't happen again.","A week's wages? For that?"),
 ('drop',"Understood. I'll earn it back.","You're dropping me?"),
 ('warn',"Got it, boss.","Is that it?"),
 ('let_go',"Cheers, boss.","Told you it was nothing."),
 ('answer_public',"I was out of order.","Say it to my face next time."),
 ('talk_private',"Thanks for listening.","About time."),
 ('side_senior',"He's right. Sorry.","Course you side with him."),
 ('team_meeting',"We needed that.","Waste of time."),]:
    L('player', f'reply_{choice}_calm', 'neutral', [calm])
    L('player', f'reply_{choice}_hot', 'angry', [hot])
json.dump({'lines': OUT}, open(sys.argv[1], 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=2)
by = {}
for e in OUT: by[e['speaker']] = by.get(e['speaker'], 0) + len(e['voText'])
print(len(OUT), 'lines; voiced chars by speaker:', by)
