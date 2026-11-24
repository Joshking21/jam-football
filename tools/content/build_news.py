"""Rewrites src/content/news.json in a local-paper voice (SPEC §16.6 v1.7). Keys and ids kept; adds `side`, a `signing`
transfer category, fan quotes with `when`, inbox senders and paper mottos.
Run from the repo root: python tools/content/build_news.py

Match tokens: {team} = winner (home side in a draw), {opponent} = loser, {player}, {score}, {minute}, {manager} (winner's),
{stadium} (home ground). `side` = which club's paper the headline is written for:
winner (that club won), loser (that club lost), any (draw). The masthead is the user's town paper.
"""
import json
p = 'src/content/news.json'
n = json.load(open(p, encoding='utf-8'))

def H(cat, rows, sides):
    return [dict(id=f'match_{cat}_{i:02d}', side=s, headline=h, sub=sub, body=b) for i, ((h, sub, b), s) in enumerate(zip(rows, sides), 1)]

W, L, A = 'winner', 'loser', 'any'
M = {}
M['big_win'] = H('big_win', [
 ("{score}. READ IT AGAIN.", "{team} take {opponent} apart.", "By the hour the away end had stopped singing and started checking train times. {player} was the best player on the pitch, and it wasn't close."),
 ("{team} RUN {opponent} RAGGED", "A {score} day nobody here will forget.", "{manager} barely left the dugout. No need. {player} ran the show."),
 ("NO MERCY", "{team} {score} {opponent}.", "There's being beaten, and there's what happened to {opponent} today. {player} led the charge and never looked back."),
 ("PARTY TIME", "{score}, and it could have been more.", "Somebody in the main stand started a conga in the second half. Nobody stopped him. {player} was magnificent."),
], [W] * 4)
M['win'] = H('win', [
 ("JOB DONE", "{team} beat {opponent} {score}. Not pretty. Don't care.", "Nervy moments, a few groans. But three points are three points, and {player} made sure of them."),
 ("{player} DOES IT AGAIN", "{team} edge past {opponent}, {score}.", "Ask anyone leaving {stadium} who won it and you'll get one name."),
 ("THREE MORE IN THE BAG", "{team} {score} {opponent}.", "{manager} called it professional. It was. Organised, patient, and quietly very good."),
 ("SMILES ALL ROUND", "{team} see off {opponent}.", "{player} was the difference, and the queue at the pub afterwards was the longest all season."),
], [W] * 4)
M['late_winner'] = H('late_winner', [
 ("AT THE DEATH!", "{player} wins it late for {team}.", "The clock said it was over. {player} disagreed. {team} {score} {opponent}, and nobody in our end has a voice left."),
 ("{player}, YOU BEAUTY", "A late winner, and {team} take all three.", "We'd settled for a point. {player} hadn't. That's the difference between a good player and a great one."),
 ("ROBBED AT THE DEATH", "{opponent} undone by a late {player} winner.", "For eighty-odd minutes they did everything right. Then they switched off for ten seconds, and that was that."),
 ("HEARTBREAK", "{team} snatch it late against {opponent}.", "It's the hope that kills you. A point was there. Then {player} took it away."),
], [W, W, L, L])
M['draw'] = H('draw', [
 ("HONOURS EVEN", "{score} between {team} and {opponent}.", "Neither side did enough to win it, and both managers knew it. Fair. Forgettable, too."),
 ("STALEMATE", "{team} and {opponent} can't be split.", "Plenty of effort, not much quality. The best moment of the afternoon was a pigeon landing on the crossbar."),
 ("ALL SQUARE", "{team} {score} {opponent}.", "{player} was the brightest thing on the pitch. On a grey day, that wasn't hard."),
 ("A POINT EACH. NOBODY HAPPY.", "{team} and {opponent} share it.", "Both dressing rooms will be quiet tonight. A draw that felt like a defeat for everyone."),
], [A] * 4)
M['comeback'] = H('comeback', [
 ("BACK FROM THE DEAD", "{team} come from behind to beat {opponent}.", "At the break it looked over. Whatever {manager} said at half-time, frame it."),
 ("NEVER IN DOUBT", "(It was.) {team} fight back to win {score}.", "Two down, and the stands were emptying. The ones who stayed will talk about it for years. {player} led the way."),
 ("THROWN AWAY", "{opponent} let a lead slip against {team}.", "In charge at half-time. Beaten at full-time. It'll take more than a night's sleep to get over that."),
 ("HOW?", "{opponent} lead, then lose, against {team}.", "No other word for it. They had it, and they let it go. {player} made them pay."),
], [W, W, L, L])
M['loss'] = H('loss', [
 ("NOT GOOD ENOUGH", "{opponent} beaten {score} by {team}.", "No excuses, and nobody offered any. {team} wanted it more, and it showed."),
 ("BEATEN", "{team} {score} {opponent}.", "A flat afternoon. A couple of half-chances, a lot of sideways passing, and one long walk home."),
 ("BACK TO THE DRAWING BOARD", "{opponent} fall to {team}.", "{player} did the damage. Our lot did the chasing. Not one for the scrapbook."),
 ("A LONG WEEK AHEAD", "Defeat to {team}, {score}.", "Don't panic. Not yet. But that was a step backwards, and everyone in the ground knew it."),
], [L] * 4)
M['heavy_loss'] = H('heavy_loss', [
 ("HUMILIATION", "{opponent} thrashed {score} by {team}.", "No dressing this one up. We were second best everywhere, and by a distance."),
 ("ROUT", "{team} hit {opponent} for {score}.", "Their fans were doing a conga by the end. Ours were heading for the exits long before that."),
 ("WHO'S SAYING SORRY?", "{score}. Yes, really.", "Supporters paid good money to watch that. Somebody owes them an apology, and a better performance on Saturday."),
 ("A DAY TO FORGET", "{opponent} crushed by {team}, {score}.", "{player} could have had more. That's the worst part: it could have been worse."),
], [L] * 4)
M['derby_win'] = H('derby_win', [
 ("OURS. AGAIN.", "{team} win the derby, {score}.", "Bragging rights stay here. They can have the long drive home and the silence. {player}, take a bow."),
 ("THE TOWN IS OURS", "Derby day belongs to {team}.", "Every tackle got a roar, every pass a cheer. And {player} gave this town the moment it wanted."),
 ("DERBY DELIGHT", "{team} {score} {opponent}.", "Nobody remembers the table in derby week. Everyone will remember this. Write the date down."),
 ("{player} OWNS THE DERBY", "{team} beat their old enemy.", "The kind of day they'll ask about at the bar for years. 'Were you there?' Plenty will say yes."),
], [W] * 4)
M['derby_loss'] = H('derby_loss', [
 ("THE WORST KIND OF DEFEAT", "{opponent} lose the derby to {team}.", "Lose any game but this one. We lost this one. A long, quiet week at work for a lot of people."),
 ("DERBY MISERY", "{team} {score} {opponent}.", "They'll be singing about it in their pubs tonight. We'll be hearing about it until the next one."),
 ("ANYTHING BUT THIS ONE", "Derby defeat for {opponent}.", "{player} scored, their end went up, and ours went very quiet. Somebody has to answer for that."),
 ("BRAGGING RIGHTS GONE", "{opponent} beaten in the derby.", "The effort was there. The quality wasn't. In a derby, effort alone gets you nothing."),
], [L] * 4)
M['upset'] = H('upset', [
 ("GIANTKILLERS", "{team} stun {opponent}, {score}.", "They came with the bigger budget and the bigger names. They went home with nothing. {player} was immense."),
 ("WHO SAID WE COULDN'T?", "{team} beat the odds against {opponent}.", "Every pundit had this as a defeat. Every pundit was wrong. Frame this one."),
 ("RED FACES", "{opponent} stunned by {team}.", "We were meant to win this easily. Nobody told {team}. A lot of questions, not many answers."),
 ("EMBARRASSING", "{opponent} beaten by {team}, {score}.", "On paper, no contest. On grass, a different story. {player} will be dining out on this for weeks."),
], [W, W, L, L])
M['hat_trick'] = H('hat_trick', [
 ("{player} TAKES THE BALL HOME", "A hat-trick as {team} beat {opponent}, {score}.", "Three goals, three different ways. The matchball is signed and on the mantelpiece already."),
 ("HAT-TRICK HERO", "{player} fires {team} past {opponent}.", "Some days everything goes in. Today was one of them, and {stadium} knew it by the third."),
 ("ONE MAN, THREE GOALS", "{player} hits a hat-trick against {opponent}.", "We couldn't get near him, and nobody tried hard enough. Three goals for him, three questions for our defence."),
 ("{player} TOO HOT TO HANDLE", "{opponent} undone by a hat-trick.", "Credit where it's due: {player} was brilliant. But who was marking him? Anyone?"),
], [W, W, L, L])
M['clean_sheet'] = H('clean_sheet', [
 ("NOTHING GETS THROUGH", "{team} shut out {opponent}, {score}.", "The back four were magnificent and the keeper barely got his gloves dirty. Boring? Lovely, more like."),
 ("BRICK WALL", "{team} keep {opponent} out.", "They pushed, they crossed, they shouted for everything. Nothing went in."),
 ("BLUNT", "{opponent} fire blanks against {team}.", "Plenty of the ball. No end product. At some point, somebody has to shoot."),
 ("NOTHING UP FRONT", "{team} {score} {opponent}.", "Their keeper could have brought a flask and a newspaper. You don't win games like that."),
], [W, W, L, L])
M['red_card'] = H('red_card', [
 ("RED MIST", "A sending-off turns it as {team} beat {opponent}.", "One rush of blood, one red card, one long walk. After that it was only going one way."),
 ("SEEING RED", "{team} win a bad-tempered one, {score}.", "Tempers went, a red card came out, and {team} kept their heads while others lost theirs."),
 ("LOST THEIR HEADS", "{opponent} beaten in a game that boiled over.", "A red card, a lot of shouting, and no points. Discipline costs. Today it cost everything."),
 ("BOILED OVER", "{team} {score} {opponent}.", "It got nasty, somebody saw red, and only one side kept their cool."),
], [W, W, L, L])
n['matchHeadlines'] = M

def T(cat, prefix, rows):
    return [dict(id=f'{prefix}_{i:02d}', headline=h, sub=s, body=b) for i, (h, s, b) in enumerate(rows, 1)]
n['transferNews'] = {
 'mega_signing': T('mega_signing', 'news_trans_mega', [
  ("€{fee}. FOR {player}.", "{team} break the bank.", "The fee is big. The expectation is bigger. {player} was all smiles today; that won't last if the goals don't come."),
  ("BIG MONEY, BIG NAME", "{player} joins {team} from {opponent} for €{fee}.", "{manager} has the player they wanted. Now the hard part: making it work."),
  ("{team} SPLASH OUT", "€{fee} brings {player} from {opponent}.", "Fans queued at the club shop for the new name on the back. That's how you know a signing matters."),
  ("HERE COMES {player}", "{team} land their man for €{fee}.", "Talks dragged on for weeks. Today the pen came out. {opponent} will miss him more than they're letting on.")]),
 'signing': T('signing', 'news_trans_sign', [
  ("{player} SIGNS FOR {team}", "€{fee} from {opponent}.", "Not the biggest name or the biggest fee. Could be the smartest business all window."),
  ("NEW FACE AT {stadium}", "{team} bring in {player} for €{fee}.", "Quietly done, no fuss. {manager} has had an eye on this one for a while."),
  ("{team} ADD {player}", "A €{fee} deal with {opponent}.", "Squad depth, they'll call it. The fans will call it something better if he scores."),
  ("IN THE DOOR: {player}", "{team} sign {player} from {opponent}.", "Fit, hungry, and cheaper than the rumours said. Decent business.")]),
 'deadline_day': T('deadline_day', 'news_trans_deadline', [
  ("LAST-MINUTE {player}", "{team} beat the clock for a €{fee} deal.", "The fax machine's long gone. The panic hasn't. Papers signed with minutes to spare."),
  ("DONE. JUST.", "{player} joins {team} on deadline day.", "Phones ringing, lawyers sweating, coffee going cold. {team} got there in the end."),
  ("DEADLINE DASH", "{team} land {player} from {opponent}.", "Nobody saw this one coming at breakfast. By midnight {player} was holding up the shirt."),
  ("THE CLOCK STOPS", "{player} signs for {team} at the last.", "A late one, a rushed one, and maybe a smart one. We'll know in a month.")]),
 'free_agent': T('free_agent', 'news_trans_free', [
  ("FREE AND EASY", "{team} sign {player} on a free.", "No fee, no fuss. If {player} still has the legs, it's the bargain of the window."),
  ("NOTHING TO LOSE", "{player} joins {team} for nothing.", "Nobody else wanted him. {team} did. Sometimes that's all a player needs."),
  ("{team} TAKE A PUNT", "Free agent {player} signs.", "A short deal, a low wage and a point to prove. What could go wrong?"),
  ("A FREE HIT", "{team} pick up {player} for nothing.", "He signed with a borrowed pen and a big grin. Now he has to play.")]),
 'transfer_listed': T('transfer_listed', 'news_trans_listed', [
  ("FOR SALE: {player}", "{team} put {player} on the list.", "No hard feelings, apparently. There never are, until there are."),
  ("{player} SHOWN THE DOOR", "{team} will listen to offers.", "It hasn't worked out, and both sides know it. A fresh start might suit everyone."),
  ("THE END FOR {player}?", "Transfer-listed by {team}.", "Fans are split. Some say he never got a fair chance. Others are already helping him pack."),
  ("ON HIS WAY?", "{team} make {player} available.", "{manager} says the door is open. That usually means it's already half open.")]),
}
n['injuryNews'] = {
 'blow': T('blow', 'news_inj_blow', [
  ("BLOW FOR {team}", "{player} out injured.", "The scan wasn't good. The physio's face, we're told, was worse. Weeks, not days."),
  ("NOT {player}. NOT NOW.", "{team} lose a key man to injury.", "Of all the players to lose, and at this point of the season. Someone else has to step up."),
  ("LIMPING", "{player} hobbles off, and {team} hold their breath.", "Ice pack on, head down, straight down the tunnel. Never a good sign."),
  ("SIDELINED", "{player} faces time on the treatment table.", "{manager} said very little. The crutches said enough.")]),
 'recovery': T('recovery', 'news_inj_recovery', [
  ("HE'S BACK", "{player} fit again for {team}.", "Back in training, back in the squad, and back to annoying the physio with how keen he is."),
  ("GOOD NEWS, AT LAST", "{player} returns for {team}.", "Weeks of gym work and bike sessions are over. Now the real test."),
  ("{player} READY TO GO", "Fit, sharp and itching to play.", "He may have lost a bit of sharpness. Judging by training, he hasn't lost his touch."),
  ("BACK IN THE MIX", "{player} available again.", "One more option for {manager}, and one more headache picking the side. The good kind.")]),
}
n['boardNews'] = {
 'backing': T('backing', 'news_board_back', [
  ("OWNER: '{manager} STAYS'", "Full backing from the top at {team}.", "The owner doesn't do statements. This week there was one. It was short: the manager stays."),
  ("{manager} HAS THE BACKING", "{team} owner says the plan is on track.", "Asked if the manager's job was safe, the owner gave a one-word answer: 'Yes.'"),
  ("NO PANIC AT THE TOP", "{team} stand by {manager}.", "Results have been mixed. Patience, apparently, hasn't run out. Yet."),
  ("VOTE OF CONFIDENCE", "{manager} backed by the owner.", "In football, a vote of confidence can mean anything. This one sounded like it meant it.")]),
 'warning': T('warning', 'news_board_warn', [
  ("PATIENCE RUNNING OUT", "{team} owner wants better, and soon.", "No shouting, no statements. Just a quiet meeting that went on two hours longer than planned."),
  ("FEEL THE HEAT, {manager}", "Pressure grows at {team}.", "The owner left early on Saturday. People notice things like that."),
  ("QUESTIONS AT THE TOP", "{team} results under the microscope.", "Nobody's saying sack. Nobody's saying safe, either."),
  ("WARNING SHOT", "{manager} told to turn it around.", "It was polite. It was private. Everyone at the club knows about it anyway.")]),
}
F = [
 ('bigWin', 'happy', "Marcus, season ticket since '87", "Forty years coming here. Today I cried twice. Once at the goals, once at the price of the pie."),
 ('bigWin', 'excited', "Sarah, East Stand", "I've lost my voice and I don't want it back."),
 ('bigWin', 'happy', "Dave, drives in every week", "Took the day off work for this. Best holiday I've had."),
 ('win', 'warm', "Jas, behind the goal", "Wasn't pretty. Don't care. Three points."),
 ('win', 'amused', "Tom, with his lad", "My boy asked if we always win. I said yes. Don't make a liar of me."),
 ('win', 'nervous', "Elena, North Stand", "Last ten minutes took ten years off me. Worth it."),
 ('draw', 'wry', "Ben, Row K", "A point. Fine. I've had worse Saturdays. Not many."),
 ('draw', 'tired', "Hannah, first season ticket", "Can we shoot? At some point? Anyone?"),
 ('draw', 'amused', "Arthur, 74, Main Stand", "We'd have won that in my day. Mind you, we'd have lost it too."),
 ('loss', 'tired', "Chloe, never misses an away", "Four hours on a coach for that. I want my sandwiches back."),
 ('loss', 'angry', "George, Row C", "Same mistakes every week. What are they practising?"),
 ('loss', 'wry', "Priya, North Stand", "Gutted. Back next week, obviously. I'm not an idiot. Well. I am. I'll be back."),
 ('bigLoss', 'angry', "Jack, season ticket holder", "Paid good money to watch us pass it sideways and lose by a mile. See you Saturday."),
 ('bigLoss', 'cold', "Dave, drives in every week", "Left on the hour. Best decision I made all day."),
 ('bigLoss', 'hurt', "Marcus, season ticket since '87", "Forty years, never booed. Today I thought about it."),
 ('derbyWin', 'amused', "Sarah, East Stand", "Should I text my brother-in-law? I'll do it slowly. Over the next week."),
 ('derbyWin', 'happy', "Tom, with his lad", "Best day of the year. Don't care what happens in May."),
 ('derbyWin', 'proud', "Arthur, 74, Main Stand", "Lived long enough to see that. Not going anywhere, mind. Next derby first."),
 ('derbyLoss', 'sad', "Jas, behind the goal", "Not going to work Monday. Can't face them."),
 ('derbyLoss', 'cold', "Ben, Row K", "Don't talk to me. Don't talk to anyone."),
 ('derbyLoss', 'hurt', "Elena, North Stand", "Lose to anyone. Anyone. Not them."),
 ('losingRun', 'angry', "George, Row C", "Something has to change. I'm not saying who. I'm looking at the dugout."),
 ('winningRun', 'excited', "Hannah, first season ticket", "Is it always like this? Nobody warned me it'd be like this."),
 ('winningRun', 'wry', "Chloe, never misses an away", "Don't say the word. You know the word. Don't."),
]
n['fanReactions'] = [dict(id=f'fan_quote_{i:02d}', when=w, emotion=e, author=a, quote=q) for i, (w, e, a, q) in enumerate(F, 1)]
n['inboxTemplates'] = {
 'rumour': [
  dict(id='inbox_rumour_01', **{'from': 'assistant'}, title="{opponent} sniffing round {player}", body="Gaffer, their scout was in again on Saturday. Third time. He's not here for the pies."),
  dict(id='inbox_rumour_02', **{'from': 'scout'}, title="{opponent} want {player}", body="Heard it from two people at the game. They're putting a bid together. A month, maybe less."),
  dict(id='inbox_rumour_03', **{'from': 'agent'}, title="About {player}", body="Just so you know, {opponent} have called. My client's happy where he is. For now. Ring me."),
  dict(id='inbox_rumour_04', **{'from': 'assistant'}, title="Paper talk: {player}", body="Seen the back pages? They've got {player} off to {opponent}. Rubbish, probably. Probably."),
 ],
 'awards': [
  dict(id='inbox_potm_01', **{'from': 'league'}, title="Player of the Month: {player}", body="Congratulations. {player} of {team} is the Meridian League Player of the Month. The trophy is small, heavy, and arriving Thursday."),
  dict(id='inbox_motm_01', **{'from': 'league'}, title="Manager of the Month", body="{manager} of {team} is the Meridian League Manager of the Month. Tradition says you lose the next game. Good luck."),
 ],
}
MOTTO = {'c01': "Read on the quay since 1881", 'c02': "Forged in Ironvale", 'c03': "Tide tables, page 30", 'c04': "Heard it here first",
         'c05': "A light on Brightwater since 1902", 'c06': "The town's paper of record", 'c07': "Births, deaths and Saturdays",
         'c08': "Weather permitting", 'c09': "Facts first", 'c10': "Fast as the news"}
for cid, m in MOTTO.items():
    n['papers'][cid]['motto'] = m
banned = ['masterclass', 'statement', 'clinical', 'shockwave', 'blade of grass', 'dominant', 'emphatic', 'talisman', 'campaign']
s = json.dumps(n, ensure_ascii=False).lower()
assert not [b for b in banned if b in s], [b for b in banned if b in s]
json.dump(n, open(p, 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=2)
print('match', sum(len(v) for v in M.values()), '| transfer', sum(len(v) for v in n['transferNews'].values()), '| fans', len(F), '| inbox', 6)
