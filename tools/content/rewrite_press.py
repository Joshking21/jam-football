"""Rewrites src/content/press.json questions and answers: short, sharp, characterful. Ids, tones, effects unchanged."""
import json, sys
Q = {
'pre_derby_01': (("Derby week against {opponent}. What does it mean to you?","Derby week. What does it mean to you?"),["We're going there to win it. Simple.","Three points, same as any other. But we know what it means to them.","They've done all the talking. We'll do ours on Saturday."]),
'pre_derby_02': (("Derbies boil over. How do you keep your players' heads?","Derbies boil over. How do you keep your players' heads?"),["Passion's fine. Stupidity isn't. They know the difference.","I want them angry. Controlled, but angry.","Ask me after the game."]),
'pre_derby_03': (("The fans call this the game of the season. Do you?","The fans call this the game of the season. Do you?"),["They're right. And we want to give it to them.","It's one game of eighteen. A big one, but one.","It will be, when we win it."]),
'pre_derby_04': (("{opponent} sat deep last time. Will you attack them?","They sat deep last time. Will you attack them?"),["From the first whistle.","We'll be patient. Derbies punish the impatient.","They can sit wherever they like. We'll find a way."]),
'post_win_01': (("Three points against {opponent}. What pleased you most?","Three points. What pleased you most?"),["The players. Every single one.","We won. We'll look at the rest on Monday.","The way we kept going. Brilliant."]),
'post_win_02': (("You held firm when they pushed late. How big was that?","You held firm when they pushed late. How big was that?"),["Huge. That's what good teams do.","We stayed calm. That's all.","We shouldn't have let them get that close."]),
'post_win_03': (("The crowd were loud today. Did you feel it down there?","The crowd were loud today. Did you feel it down there?"),["Every second. They won us that.","They were great. We owe them more of that.","I was watching the game. But yes."]),
'post_win_04': (("Your changes at half-time won it. Planned or instinct?","Your changes at half-time won it. Planned or instinct?"),["We saw a gap. We went for it.","The players deserve the credit, not me.","I'd love to say planned. I'll say planned."]),
'post_big_win_01': (("{score}. Was that the best you've played?","That was emphatic. Was that the best you've played?"),["Today, yes. Enjoy it, everybody.","It's three points. The same as one-nil.","I think there's better to come."]),
'post_big_win_02': (("You scored for fun. What clicked?","You scored for fun. What clicked?"),["Everybody wanted the ball. That's when it clicks.","The movement. Watch it again, it's lovely.","We missed three more. I'll mention that."]),
'post_big_win_03': (("Could that goal difference decide the season?","Could that goal difference decide the season?"),["It might. We'll take it.","I'm not thinking about May.","Let's hope we don't need it."]),
'post_big_win_04': (("You rested players early. Planning ahead?","You rested players early. Planning ahead?"),["It's a long season. Legs matter.","The squad deserves minutes too.","When it's done, it's done. No point risking anyone."]),
'post_draw_01': (("A point against {opponent}. Gained, or two dropped?","A point. Gained, or two dropped?"),["Two dropped. We should have won.","A point's a point. We move on.","About right, if I'm honest."]),
'post_draw_02': (("They fouled you out of your rhythm. Was the referee too soft?","They fouled you out of your rhythm. Was the referee too soft?"),["Watch it back and tell me.","I don't talk about referees.","We have to play through that. We didn't."]),
'post_draw_03': (("Few chances today. Is the attack firing?","Few chances today. Is the attack firing?"),["They'll score. I trust them.","Not today, no.","It was a tight game. Chances were rare for both."]),
'post_draw_04': (("You went for the win late. Worth the risk?","You went for the win late. Worth the risk?"),["Always. I play to win.","We'll take the point.","Ask me if we'd scored."]),
'post_loss_01': (("{opponent} take the points. Where did it go wrong?","Where did it go wrong today?"),["On me. I got it wrong.","The basics. We didn't do them.","We'll be back. Write that down."]),
'post_loss_02': (("The fans booed at the end. Do you understand why?","The fans booed at the end. Do you understand why?"),["Completely. I'd boo that too.","They can boo me. Not the players.","We'll give them something to cheer. Soon."]),
'post_loss_03': (("Another set-piece goal against you. Is it in their heads?","Another set-piece goal against you. Is it in their heads?"),["It's in mine. We'll fix it.","No. It's a detail. We'll work on it.","Nobody's scared of a corner. It won't happen again."]),
'post_loss_04': (("How do you pick them up before next week?","How do you pick them up before next week?"),["We work. That's the only answer.","I tell them the truth. Then we go again.","Together. Same as always."]),
'post_big_loss_01': (("Beaten {score}. How do you explain that?","How do you explain that result?"),["I can't. And I'm furious.","The supporters deserved better. I'm sorry.","We were cut open in transition all day. We'll fix it."]),
'post_big_loss_02': (("After that, are you worried about your job?","After that, are you worried about your job?"),["No. I'm worried about Saturday.","That's not for me to decide.","Next question."]),
'post_big_loss_03': (("Will there be changes after that?","Will there be changes after that?"),["Yes. Nobody's safe.","We'll see in training.","They're good players. They'll respond."]),
'post_big_loss_04': (("They called your defending schoolboy. Fair?","They called your defending schoolboy. Fair?"),["Today? Yes.","I don't listen to them.","We'll let our defending answer that."]),
'post_upset_win_01': (("Nobody gave you a chance against {opponent}. How?","Nobody gave you a chance. How?"),["We found a gap and hit it.","Because they believed. That's all.","We got a bit lucky too. I'll take it."]),
'post_upset_win_02': (("They spent far more than you. Does money not matter?","They spent far more than you. Does money not matter?"),["Heart matters more today.","Money helps. So does work.","Maybe they should spend it differently."]),
'post_upset_win_03': (("Can this change your season?","Can this change your season?"),["It should. Aim higher now.","One result. Let's not get carried away.","I'm proud. Let's see where it takes us."]),
'post_upset_win_04': (("Did you speak to their manager at the end?","Did you speak to their manager at the end?"),["Shook his hand. Good side, good man.","He didn't seem in the mood.","He'll be fine. He's got money to spend."]),
'streak_win_01': (("Three wins in a row. Can anyone stop you?","Three wins in a row. Can anyone stop you?"),["Not if we keep this up.","Yes. Anybody, on their day.","The players are flying. Credit to them."]),
'streak_win_02': (("The fans are talking about the title. Too early?","The fans are talking about the title. Too early?"),["Let them dream. I'm not stopping them.","Far too early. Next game.","Why not us?"]),
'streak_win_03': (("You look fitter than everyone late on. The secret?","You look fitter than everyone late on. The secret?"),["Hard work. Nothing secret about it.","We manage minutes carefully.","They could be fitter. I'll tell them."]),
'streak_win_04': (("Teams will sit deeper against you now. Ready for that?","Teams will sit deeper against you now. Ready for that?"),["We've been ready for weeks.","Let them. We'll find a way.","Fair enough. We'd do the same."]),
'streak_loss_01': (("Three defeats in a row. How do you stop this?","Three defeats in a row. How do you stop this?"),["We win on Saturday. Simple.","Honestly? I'm sick of it.","Calmly. Panic never fixed anything."]),
'streak_loss_02': (("The fans are turning. Do you feel it?","The fans are turning. Do you feel it?"),["I don't read it. I fix it.","Of course. They're right to be fed up.","They'll be back on side when we win."]),
'streak_loss_03': (("Will you change the system?","Will you change the system?"),["If it helps us win, yes.","No. The system isn't the problem.","The problem's between their ears."]),
'streak_loss_04': (("Is Saturday a must-win?","Is Saturday a must-win?"),["They all are now.","Every game matters. This one too.","Ask me on Saturday night."]),
'player_praise_01': (("{player} ran the show today. Best you've seen from him?","He ran the show today. Best you've seen from him?"),["Brilliant. Absolutely brilliant.","He was great, and so were the other ten.","He can do more. And he will."]),
'player_praise_02': (("Bigger clubs will want {player} now. Is he for sale?","Bigger clubs will be watching him. Is he for sale?"),["No.","Everyone has a price. We're not looking.","Of course they want him. He's that good."]),
'player_praise_03': (("Did you tell {player} to roam today?","Did you tell him to roam today?"),["We gave him freedom. He used it.","That's him. He sees things nobody else does.","I'd love the credit. He deserves it."]),
'player_praise_04': (("A standing ovation for {player}. How did that feel?","A standing ovation for him. How did that feel?"),["Goosebumps. He deserved every second.","Nice moment. Now he does it again.","Next time I'll let him finish the game."]),
'player_criticism_01': (("{player} struggled and came off early. Is his place at risk?","He struggled and came off early. Is his place at risk?"),["He's my player. He'll come good.","Everyone's place is at risk. His too.","It was a tactical change. Nothing more."]),
'player_criticism_02': (("{player} looked angry to come off. Problem?","He looked angry to come off. Problem?"),["He'll knock on my door. That's how we sort it.","Good. I want players who care.","Nothing to see."]),
'player_criticism_03': (("Is {player} carrying an injury?","Is he carrying an injury?"),["A small one. He'll be fine.","I don't talk about injuries.","He was tired. He's human."]),
'player_criticism_04': (("The young lads are pushing. Is {player} at risk of being left behind?","The young lads are pushing. Is he at risk?"),["He'd better be ready.","He'll respond. He always does.","Competition's good. For everyone."]),
'transfer_rumour_01': (("Clubs are lining up bids for your best players. Worried?","Clubs are lining up bids for your best players. Worried?"),["They're not for sale.","If the money's right, we'd listen. Anyone would.","Nobody's called me."]),
'transfer_rumour_02': (("The fans want signings. Any coming?","The fans want signings. Any coming?"),["Yes. Soon.","Only the right ones.","We've got a good squad already."]),
'transfer_rumour_03': (("Are clubs asking too much for players?","Are clubs asking too much for players?"),["Some of the prices are a joke.","It's the market. We work with it.","We'll pay for the right one."]),
'transfer_rumour_04': (("Have the rumours unsettled the dressing room?","Have the rumours unsettled the dressing room?"),["Not at all.","If they have, they'd better settle.","It's normal. I talk to them."]),
'opening_day_01': (("Day one. What's the target this season?","Day one. What's the target this season?"),["To win it.","To be better than last year.","Ask me in May."]),
'opening_day_02': (("Is the squad fit and ready?","Is the squad fit and ready?"),["More than ready.","Mostly. A couple are a week away.","They'd better be."]),
'opening_day_03': (("What does that first walk out of the tunnel feel like?","What does that first walk out of the tunnel feel like?"),["Like being a kid again.","It's lovely. Then it's work.","It's why we do this."]),
'opening_day_04': (("{opponent} first up. A chance to make a statement?","A chance to make a statement on day one?"),["Absolutely. Watch us.","They're a good side. We respect them.","Every game's a statement."]),
}
p = sys.argv[1]
d = json.load(open(p, encoding='utf-8'))
n = 0
for q in d['questions']:
    (t, v), ans = Q[q['id']]
    q['text'] = t.replace('{club}', '{team}'); q['voText'] = v
    assert len(q['answers']) == 3
    for a, line in zip(q['answers'], ans):
        a['text'] = line; a['voText'] = line
    n += 1
json.dump(d, open(p, 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=2)
print(n, 'questions rewritten;', sum(len(q['voText']) for q in d['questions']), 'question chars;', sum(len(a['voText']) for q in d['questions'] for a in q['answers']), 'answer chars')
