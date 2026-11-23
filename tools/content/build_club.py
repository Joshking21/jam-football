"""Writes src/content/club.json (SPEC §16.9, §12.19, §12.20.3, §13.21, §11.25.5)."""
import json, sys, re
OUT = []
def L(speaker, set_, mood, texts, voiced=True):
    for i, t in enumerate(texts, 1):
        slot = 'start' if t.startswith('{player}') else 'end' if t.endswith('{player}.') or t.endswith('{player}?') or t.endswith('{player}!') or t.endswith('{player}') else 'none'
        vo = t
        if slot == 'start': vo = t[len('{player}'):].lstrip(' ,.…')
        if slot == 'end': vo = re.sub(r',?\s*\{player\}([.?!]?)$', r'\1', t)
        assert '{' not in vo, (set_, t)
        e = {'id': f'{speaker}_{set_}_{i:02d}', 'speaker': speaker, 'set': set_, 'mood': mood, 'text': t, 'voText': vo[0].upper() + vo[1:] if vo else vo, 'voiced': voiced}
        if slot != 'none': e['nameSlot'] = slot
        OUT.append(e)
# ---------------- owner / directors ----------------
L('owner','welcome','neutral',["Welcome to the club. Sit down. Let's talk about what we expect.","Thank you for coming. This club has waited a long time for the right person.","Come in. You've seen the stadium. Now let me tell you what it needs."])
L('owner','offer_close','neutral',["Those are our terms. So, will you take the job?","That's the offer. Are you our manager?"])
L('owner','review_happy','happy',["The board is pleased. Keep doing exactly this.","Good work. The town is talking about us again.","We're where we hoped to be. Don't let it slip."])
L('owner','review_neutral','neutral',["It's been steady. Steady won't be enough by May.","We're watching. We need more than this.","Not bad. Not good enough yet."])
L('owner','review_worried','worried',["I'll be honest. The board is getting nervous.","This can't go on much longer. You know that.","We backed you. We need to see something back."])
L('owner','budget_granted','happy',["Fine. You've earned it. Spend it wisely.","The board has agreed. Don't make me regret it."])
L('owner','budget_refused','neutral',["No. Not until the results justify it.","The money isn't there. Work with what you have."])
L('owner','sacking','angry',["I'm sorry. The board has decided to make a change.","We can't wait any longer. We're letting you go.","This is the hardest part of my job. You're relieved of your duties."])
L('owner','verdict_great','happy',["You gave this town a season to remember. We want you here for years.","That's beyond what we asked for. Thank you."])
L('owner','verdict_ok','neutral',["A solid first season. Next year, we push on.","You did what we asked. Now let's ask for more."])
L('owner','verdict_poor','worried',["That wasn't good enough, and you know it.","We expected more. Much more."])
L('director','aside','neutral',["The finances are sound, for now.","The supporters' groups want a word at some point.","We'll need the stadium full every week to make the numbers work."])
# ---------------- coach ----------------
L('coach','walk_in','neutral',["Right, lads.","Sit down, everyone.","Listen in.","Okay. Eyes on me.","Morning, all.","Phones away.","Gather round.","Right, let's go."])
L('coach','briefing_mentality','neutral',["We go at them from the first whistle. No respect.","Patient today. We let them come and we hit them on the break.","Balanced. Win our battles and the game opens up."])
L('coach','briefing_press','neutral',["We press high. Their centre-backs don't like the ball.","No pressing up top today. Mid-block, and we stay compact.","When we lose it, we win it back in five seconds. That's the rule."])
L('coach','briefing_key_battle','neutral',["{player}, their winger is quick. Stay on your feet.","This game is won in midfield. You run it, {player}.","Their number nine is the danger. Don't give him a yard, {player}."])
L('coach','briefing_set_pieces','neutral',["Corners: big men to the far post. We've practised it.","Their set pieces are dangerous. Everyone picks up a man.","{player}, you're on the free kicks today."])
L('coach','briefing_width','neutral',["Stay wide. Stretch them and the gaps will come.","Narrow today. Crowd the middle and make them go round.","Full-backs, you're our width. Get forward."])
L('coach','shout_pushForward','neutral',["Push up! Get forward!","Up the pitch! Go on!","Higher! Get after them!"])
L('coach','shout_keepTight','neutral',["Keep it tight! Stay in shape!","Compact! Nothing through the middle!","Hold it! Keep your shape!"])
L('coach','shout_getStuckIn','angry',["Get stuck in!","Win your battles! Get in their faces!","Tackle! Make it hurt!"])
L('coach','shout_calmDown','neutral',["Calm down! Stay on your feet!","Easy! No silly fouls!","Heads! Keep your heads!"])
L('coach','shout_concentrate','neutral',["Concentrate! Ten more minutes!","Switch on! Nobody switches off!","Focus! Every ball!"])
L('coach','shout_encourage','happy',["Well done! Keep going!","Brilliant! More of that!","That's it, lads! Keep it up!"])
L('coach','shout_demandMore','angry',["That's not good enough!","Wake up! Come on!","More! I want more!"])
L('coach','accept_job','happy',["I'll take it. We'll win it.","Count me in. Let's get to work."])
L('coach','discipline_fine','neutral',["That's a week's wages. Don't let it happen again.","You're fined. You let the lads down, {player}."])
L('coach','discipline_drop','neutral',["You're not in the squad on Saturday.","Sit this one out. Think about it, {player}."])
L('coach','discipline_warn','neutral',["Consider this a warning. There won't be another.","That's your one warning, {player}."])
L('coach','discipline_let_go','neutral',["Forget it. Just don't do it again.","We'll leave it there."])
L('coach','discipline_answer_public','angry',["If he has something to say, he can say it to me.","Nobody is bigger than this club. Nobody."])
L('coach','discipline_talk_private','neutral',["Come and see me after training. Just us.","My door's open. Let's talk, {player}."])
L('coach','discipline_side_senior','neutral',["He's been here longer. Listen to him.","{player}, you're out of line. Apologise."])
L('coach','discipline_team_meeting','neutral',["Everybody in. We sort this now, together.","Both of you. In the middle. We clear the air."])
L('coach','injury_take_off','neutral',["Get him off. Not worth the risk.","Bring him off. Warm up the sub."])
L('coach','injury_carry_on','neutral',["He stays on. He's tougher than that.","Strap it up. He's carrying on."])
L('coach','injury_rush_yes','neutral',["Get him ready. We need him on Saturday.","If he says he's fine, he plays."])
L('coach','injury_rush_wait','neutral',["No. Another week. I'm not losing him for a month.","Give him the time. He'll be back when he's back."])
L('coach','warmup_start','neutral',["He starts. Keep an eye on him.","He plays. Tell me if it gets worse."])
L('coach','warmup_leave_out','neutral',["Leave him out. Don't risk it.","Change it. He's on the bench."])
# ---------------- Theo ----------------
L('assistant','knock_enter','neutral',["Gaffer, got a minute?","Morning, boss. I've got the week's notes.","Knock knock. Bad time?","Boss. Quick one."])
L('assistant','whiteboard','neutral',["Look here. That's where they're weak.","If we shift this one across, the gap closes.","Their full-back gets caught upfield. Every time.","On that side, I'd put {player}.","Here's the problem, gaffer. Look at the space.","That's how they scored last week. Same pattern."])
L('assistant','touchline_whisper','neutral',["Gaffer. Look at their left side.","Their nine is tiring. Push up on him.","We're getting overrun in the middle.","They've switched to a back three.","Their keeper's coming for everything. Shoot early.","Ten minutes left. We need to decide."])
L('assistant','talk_opener_pre','neutral',["Right, gaffer. The lads are ready.","They're quiet. Might need waking up.","Good mood in here. Use it."])
L('assistant','talk_opener_ht','neutral',["Gaffer. A few things before you start.","They're rattled, not beaten.","We've had the better chances. They know it."])
L('assistant','talk_opener_ft','neutral',["Your call, gaffer. They're all yours.","Heads are down in here.","They've given everything. Let them hear it."])
L('assistant','welcome_after_job','happy',["Theo Vance. Assistant. I've been here eight years. I know where the bodies are buried.","Welcome, gaffer. Let's get to work."])
L('assistant','incident_open_late','worried',["{player} was late again this morning. Twenty minutes.","{player} turned up halfway through the warm-up, boss."])
L('assistant','incident_open_sent_off','worried',["About that red card. The lads are waiting to see what you do.","That sending off cost us. People want to know what happens now."])
L('assistant','incident_open_press','worried',["{player} has been talking to the papers. Have you seen it?","{player} gave an interview. It's not pretty."])
L('assistant','incident_open_bustup','worried',["We had a bust-up in training. Two of them had to be pulled apart.","It kicked off on the pitch today. Not good."])
L('assistant','incident_advice_late','neutral',["A fine sends a message. The lads notice.","Once is a mistake. Twice is a habit."])
L('assistant','incident_advice_sent_off','neutral',["He cost us the game. A fine would be fair.","He knows he was daft. Maybe a word is enough."])
L('assistant','incident_advice_press','neutral',["Answer him in public and you'll lose him.","Talk to him first. You can always fine him later."])
L('assistant','incident_advice_bustup','neutral',["Get everybody in a room. Clear the air.","Back the senior lad. The young one needs to learn."])
# ---------------- physio ----------------
L('physio','knock_read','neutral',["He can carry on, gaffer. He's not at a hundred percent.","It's a knock. He can run it off, but it'll hurt.","He wants to stay on. Your call."])
L('physio','rush_offer','neutral',["He's close, gaffer. We could risk him this week.","Another week would be safer, but he says he's ready.","He's done the tests. He could play, if you need him."])
L('physio','warmup_scare','worried',["{player} felt something tight in the warm-up, gaffer.","{player} has pulled up in the warm-up. Hamstring's tight.","{player}'s calf is tight. He says he's fine."])
L('physio','outcome_good','happy',["He came through it. No reaction.","Good news. He's fine after ninety minutes."])
L('physio','outcome_bad','worried',["It's gone again. Longer this time, I'm afraid.","He's broken down. We pushed him too soon."])
# ---------------- players: replies to discipline choices (calm / hot-headed) ----------------
for choice, calm, hot in [
 ('fine',["Fair enough, boss. It won't happen again.","I deserved that. Sorry."],["A week's wages? For that?","Fine. Whatever."]),
 ('drop',["I understand. I'll be ready next week.","Okay. I'll earn it back."],["You're dropping me? Seriously?","Unbelievable."]),
 ('warn',["Understood, boss.","It won't happen again."],["Yeah, yeah. Got it.","Is that it?"]),
 ('let_go',["Thanks, boss. I appreciate it.","Cheers. Won't let you down."],["Good. It wasn't a big deal anyway.","Told you."]),
 ('answer_public',["That's fair. I shouldn't have said it.","I was out of order. I'll apologise."],["So that's how it is.","Say it to my face next time."]),
 ('talk_private',["Thanks for hearing me out.","I just want to play, boss. That's all."],["Finally, someone listens.","About time we talked."]),
 ('side_senior',["He's right. I'm sorry.","Okay. I'll learn from it."],["Of course you side with him.","Brilliant. Thanks a lot."]),
 ('team_meeting',["Good. Let's sort it out.","Fair. We needed that."],["Fine. Let's get it over with.","Waste of time, but okay."])]:
    L('player', f'reply_{choice}_calm', 'neutral', calm)
    L('player', f'reply_{choice}_hot', 'angry', hot)
json.dump({'lines': OUT}, open(sys.argv[1], 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=2)
by = {}
for e in OUT: by[e['speaker']] = by.get(e['speaker'], 0) + len(e['voText'])
print(len(OUT), 'lines; voiced chars by speaker:', by)
