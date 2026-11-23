"""Writes src/content/assistant.json (SPEC §15, §16.5, plus the v1.7 rules in §12.18.4, §13.20.9, §13.21, §13.22)."""
import json, sys
R = {
# §15.2 pre-match
'pre_play_out_quick': (["They press high. Get it out quickly: mix the passing and up the tempo.","Their press is hungry. Move it fast and we'll be through it."],"Their pressing is high and our back line has the pace to play through it."),
'pre_go_in_behind': (["Their line is high. Go direct and get {player} running in behind.","Ball over the top, gaffer. {player} will murder that line."],"Their defensive line is high and our quickest forward can exploit it."),
'pre_attack_weak_side': (["Their {lane} is the weak link. Focus our attacks down there.","Go at their {lane}. That's where they'll crack."],"Their weakest defender plays on that side."),
'pre_stay_compact': (["They're better than us on paper. Sit a bit deeper and stay compact.","Let's not open up. Defensive mentality, deep line, mid press."],"Their average rating is well above ours."),
'pre_take_game': (["We're the better side. Take the game to them.","No respect for them today. Attacking mentality from the start."],"Our average rating is well above theirs."),
'pre_cb_reassure': (["They'll put crosses in all day. Let them. Our centre-backs eat those.","Plenty of balls into the box coming. I'm not worried about that."],"Our centre-backs dominate in the air and they play wide."),
'pre_set_piece_threat': (["Watch their corners. Put {player} on their big man.","Their target man is dangerous at set pieces. Let's mark him tight."],"Their best header is a real threat at set pieces."),
# §15.3 week tips
'week_rest': (["{player} is running on fumes. Give him a rest this week.","Rest {player}. He's no use to us half-fit."],"His fatigue is above 80."),
'week_train_tactical': (["The lads don't know the shape yet. Let's do more tactical work.","We need sessions on the shape. They're still learning it."],"Familiarity with our formation is under 50."),
'week_light_training': (["Ease off this week. Too many of them are tired.","Light week, gaffer. We need legs for Saturday."],"Three or more players are under 70% condition."),
'week_talk_unhappy': (["Have a word with {player}. He's not happy.","{player} has a face on him. Worth a chat."],"An important player is unhappy."),
'week_give_minutes': (["{player} is ready for minutes. He could be a big player for us.","Give {player} a run out. The kid's got something."],"A high-potential youngster has barely played."),
'week_positive': (["Training was sharp today. Good mood about the place.","No complaints this week. They're in a good place."],"Nothing needs fixing."),
# §12.18.4 Theo's week
'tw_recovery_swap': (["Swap the hard sessions for recovery. {player} and two others are over 50 fatigue.","Too many tired legs. Recovery in, endurance out."],"Four or more starters have fatigue over 50."),
'tw_shape_work': (["Shape work on Thursday. They're still not sharp on the system.","Let's do some shape work late in the week. They're not sharp on the system yet."],"A familiarity area is below 70."),
'tw_opponent_prep': (["Friday: opponent prep. They go wide, so let's prep for their wingers.","Use Friday to prepare for {opponent}. I've a plan for their press."],"The next opponent has a clear style to prepare for."),
'tw_set_pieces': (["Set-piece practice on Thursday. They've a big lad who wins everything.","Let's drill corners this week. Their aerial threat worries me."],"The next opponent is dangerous from set pieces."),
# §15.4 in-match
'im_flank_exposed': (["They're getting joy down our {lane}. Tell {player} to stay back.","Our {lane} is wide open. {player} needs to hold his position."],"Over half their attacks are coming down one side."),
'im_drop_press': (["The lads are running out of legs. Drop the press.","We can't keep this press up. Ease it to mid-block."],"We're pressing high and our average condition is falling."),
'im_keep_floor': (["We're losing every header. Keep it on the floor.","Stop crossing. Their centre-backs are winning everything."],"Our crosses aren't working and they're bigger in the air."),
'im_go_direct': (["Their line is high. Time the runs and go direct.","Get it in behind them. Their line's up."],"Their line is high and we keep getting caught offside."),
'im_tired_player': (["{player} is out on his feet.","Get {player} off. He's got nothing left."],"His condition is below 58."),
'im_yellow_risk': (["{player} is one tackle from a red.","Take {player} off before the ref does."],"He's on a yellow and still committing fouls."),
'im_need_goal': (["We need a goal. Go for it.","Throw the kitchen sink at them, gaffer."],"We're losing with 20 minutes left."),
'im_see_it_out': (["See it out. Slow it down.","Game management now. Keep the ball and kill the clock."],"We're a goal up with 10 minutes left."),
'im_calm_down': (["We keep giving it away. Calm it down.","Too many long balls. Get it on the deck and keep it."],"Our possession has dropped under 35%."),
'im_plan_b': (["Time for Plan B?","This isn't working. Switch to Plan B?"],"We're losing after 60 minutes and Plan B is more attacking."),
'im_shout_calm': (["Two of ours are on yellows. Calm them down?","Tell them to stay on their feet. We can't go down to ten."],"Two or more of our players are on a yellow."),
'im_shout_push': (["Shout at them to push up. We're sitting too deep.","Get them forward. We're inviting pressure."],"We're losing and pinned in our own half."),
# §13.20.9 set pieces
'sp_rotate': (["They've read our near-post routine. Rotate?","Same corner every time and they've worked it out. Mix it up."],"We've used the same routine three times and lost the headers."),
'sp_mark_target': (["Put {player} on their big man at corners.","Their number nine is the threat. Mark him with {player}."],"Their best header is a big set-piece threat."),
'sp_drop_forward': (["Drop a forward back. They're winning everything at corners.","Bring one back for corners. We're getting bullied in our box."],"They've won three or more headers in our box in 20 minutes."),
# §15.5 half-time analysis
'ht_xg': (["Look at the chances. We're not creating enough.","The xG says we're the better side. Keep going."],"Shots and xG so far."),
'ht_danger_man': (["{player} is running the show for them. Someone needs to get tight.","Keep an eye on {player}. Everything goes through him."],"Their most involved player in shots."),
'ht_worst_starter': (["{player} is having a nightmare. I'd take him off.","{player} isn't at it. Worth a change?"],"Our lowest-rated starter."),
# post-match
'pm_beat_expectation': (["That's a big result. More than we could have asked for.","Nobody gave us a chance today. Brilliant."],"We beat a stronger side."),
'pm_met_expectation': (["Job done. That's what we came for.","Professional. Three points and home."],"The result we expected."),
'pm_below_expectation': (["We let that one slip. That's on all of us.","Not good enough today, and the lads know it."],"We dropped points we expected to win."),
'pm_best_player': (["{player} was outstanding. Best on the pitch.","{player} was different class."],"Our highest-rated player."),
'pm_work_on': (["We need to work on finishing this week.","Defending the box. That's what we drill this week."],"The stat that decided the match maps to a training focus."),
}
rules = {k: {'variants': v, 'reason': r} for k, (v, r) in R.items()}
remarks = ["The squad looked sharp in training today.","{player}'s been staying late to practise his finishing.","The pitch at the training ground is in good nick after the rain.","The kitman says the new boots are being worn in.","{player} has been organising the young lads. Natural leader.","The canteen ran out of beans. There was nearly a riot.","Good energy in the dressing room this morning.","The physio's happy with how the squad is recovering.","{player} asked me about the offside trap twice today. Keen.","The groundsman wants the pitch watered before Saturday.","A few of the lads were doing extra sprints after the session.","The fans are talking about us. Up the coast and down it.","{player}'s been watching videos of wingers on his phone all week.","The rondo got competitive today. {player} didn't let one through.","{player} is in a good mood. That's usually good news.","The board sent fruit. Nobody's touched it.","{player} kept himself to himself today.","{player} brought his kids to watch training. Lovely moment.","The youth team coach says there's a lad worth watching.","The weather's turning. Winter football's coming.","{player} read the game beautifully in the practice match.","We tried the new corner routine. Looked decent.","{player} and {player2} have been inseparable at lunch.","The lads want to know if there's a team meal this week.","{player} says his back is feeling better.","{player} has been shouting at the defence all session. Good.","I watched their last two games again. I have notes.","The press officer says the Gazette want five minutes.","Spirit's good. It's a happy camp.","Quiet day. Sometimes that's the best kind."]
stingers = [{'id': f'stinger_{i}', 'text': t, 'voiced': True} for i, t in enumerate(["Gaffer!","Boss, a word.","Gaffer, look at this.","Quick one, boss.","Boss!","Hang on, gaffer."], 1)]
greetings = [{'id': f'greet_{i}', 'text': t, 'voiced': True} for i, t in enumerate(["Morning, gaffer.","Morning, boss. Coffee's on.","All right, gaffer. Busy week.","Morning. I've got a few things for you."], 1)]
ht = [{'id': f'ht_open_{i}', 'text': t, 'voiced': True} for i, t in enumerate(["Right, a few things, gaffer.","Here's what I'm seeing.","Not bad, but we can be better.","We need to fix something, boss."], 1)]
pm = [{'id': f'pm_open_{i}', 'text': t, 'voiced': True} for i, t in enumerate(["Well, gaffer.","Right. Let's talk about that one.","What a game.","Tough one to take."], 1)]
json.dump({'rules': rules, 'remarks': remarks, 'stingers': stingers, 'greetings': greetings, 'halfTimeOpeners': ht, 'postMatchOpeners': pm},
          open(sys.argv[1], 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=2)
print(len(rules), 'rules,', len(remarks), 'remarks; voiced chars:', sum(len(x['text']) for x in stingers + greetings + ht + pm))
