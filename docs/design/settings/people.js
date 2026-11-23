// shared drawn-people kit for the talk-scene concepts (painted face layers)
const SKIN=['#F1D3BC','#E0B18F','#C68B63','#A0694A','#7A4B33','#4E3022'],HAIR=['#1A1410','#3B2A1E','#6A4A30','#A07A4C','#8a8a8a'];
function pFace(cx,cy,r,mood,turn,talk){cx+=(turn||0)*r*.32;const e=r*.31,ey=cy-r*.06,c='#1a1210';let s='';
 const eye=x=>`<ellipse cx="${x}" cy="${ey}" rx="${r*.085}" ry="${r*.11}" fill="${c}"/>`;s+=eye(cx-e)+eye(cx+e);
 const by=ey-r*.24,bw=r*.2;const brow=(x,sd)=>{let y1=by,y2=by;if(mood==='angry'){y1=sd<0?by-4:by+5;y2=sd<0?by+5:by-4}if(mood==='worried'){y1=sd<0?by+3:by-5;y2=sd<0?by-5:by+3}if(mood==='happy'){y1=y2=by-2}return `<line x1="${x-bw}" y1="${y1}" x2="${x+bw}" y2="${y2}" stroke="${c}" stroke-width="${r*.07}" stroke-linecap="round"/>`};
 s+=brow(cx-e,-1)+brow(cx+e,1);const my=cy+r*.42,mw=r*.26;
 if(talk)s+=`<ellipse cx="${cx}" cy="${my}" rx="${mw*.65}" ry="${r*.13}" fill="#3a1410"/>`;
 else if(mood==='happy')s+=`<path d="M${cx-mw} ${my-3} q${mw} ${r*.24} ${mw*2} 0" stroke="${c}" stroke-width="${r*.06}" fill="none" stroke-linecap="round"/>`;
 else if(mood==='angry')s+=`<path d="M${cx-mw} ${my+4} q${mw} ${-r*.2} ${mw*2} 0" stroke="${c}" stroke-width="${r*.06}" fill="none" stroke-linecap="round"/>`;
 else if(mood==='worried')s+=`<path d="M${cx-mw*.7} ${my+2} q${mw*.7} ${-r*.1} ${mw*1.4} 0" stroke="${c}" stroke-width="${r*.055}" fill="none"/>`;
 else s+=`<line x1="${cx-mw*.8}" y1="${my}" x2="${cx+mw*.8}" y2="${my}" stroke="${c}" stroke-width="${r*.055}" stroke-linecap="round"/>`;
 return s}
function pHead(cx,cy,r,skin,hair,mood,turn,talk,bald){let s='';
 s+=`<rect x="${cx-r*.42}" y="${cy+r*.6}" width="${r*.84}" height="${r*.8}" fill="${skin}"/>`;
 if((turn||0)<=.3)s+=`<ellipse cx="${cx+r*.98}" cy="${cy+r*.05}" rx="${r*.14}" ry="${r*.22}" fill="${skin}"/>`;
 if((turn||0)>=-.3)s+=`<ellipse cx="${cx-r*.98}" cy="${cy+r*.05}" rx="${r*.14}" ry="${r*.22}" fill="${skin}"/>`;
 s+=`<ellipse cx="${cx}" cy="${cy}" rx="${r*.95}" ry="${r*1.08}" fill="${skin}"/>`;
 if(!bald)s+=`<path d="M${cx-r*.96} ${cy-r*.1} q${-r*.05} ${-r*1.05} ${r*.96} ${-r*1.02} q${r} 0 ${r*.96} ${r*1.0} q${-r*.3} ${-r*.55} ${-r*.96} ${-r*.58} q${-r*.6} 0 ${-r*.96} ${r*.6}z" fill="${hair}"/>`;
 else s+=`<path d="M${cx-r*.96} ${cy-r*.05} q0 ${-r*.4} ${r*.2} ${-r*.5}" stroke="${hair}" stroke-width="${r*.18}" fill="none"/><path d="M${cx+r*.96} ${cy-r*.05} q0 ${-r*.4} ${-r*.2} ${-r*.5}" stroke="${hair}" stroke-width="${r*.18}" fill="none"/>`;
 s+=pFace(cx,cy+r*.12,r,mood,turn,talk);
 s+=`<ellipse cx="${cx-r*.35}" cy="${cy-r*.35}" rx="${r*.35}" ry="${r*.25}" fill="#fff" opacity=".07"/>`;
 return s}
// seated, facing camera; o={skin,hair,mood,turn,talk,top,top2,legs,suit,tie,pose,scale,bald}
function pSeated(x,y,o){const sc=o.scale||1;let s=`<g transform="translate(${x},${y}) scale(${sc})">`;const r=30,hy=-180,sh=hy+r+14;
 s+=`<path d="M-50 ${sh+6} q50 -14 100 0 l8 ${-sh-2} h-116z" fill="${o.top}"/>`;
 if(o.suit){s+=`<path d="M-16 ${sh-2} l16 40 l16 -40z" fill="#e9e4da"/><path d="M-4 ${sh+4} l4 4 l4 -4 l-2 34 l-2 4 l-2 -4z" fill="${o.tie||'#7a1f22'}"/><path d="M-16 ${sh-2} l-14 50 M16 ${sh-2} l14 50" stroke="rgba(0,0,0,.3)" stroke-width="3"/>`}
 else s+=`<path d="M-14 ${sh-2} l14 16 l14 -16" stroke="${o.top2||'#F2B705'}" stroke-width="3" fill="none"/>`;
 const arm=d=>`<path d="${d}" stroke="${o.top}" stroke-width="20" stroke-linecap="round" fill="none"/>`,hand=(hx,hy2)=>`<circle cx="${hx}" cy="${hy2}" r="10" fill="${o.skin}"/>`;
 if(o.pose==='folded')s+=`<rect x="-52" y="${sh+38}" width="104" height="30" rx="14" fill="${o.top}" stroke="rgba(0,0,0,.35)" stroke-width="2"/>`+hand(-46,sh+52)+hand(46,sh+56);
 else if(o.pose==='table')s+=arm(`M-48 ${sh+12} q-10 40 10 ${-sh-6}`)+arm(`M48 ${sh+12} q10 40 -10 ${-sh-6}`)+hand(-36,-8)+hand(36,-8);
 else if(o.pose==='gesture')s+=arm(`M-48 ${sh+12} q-10 40 10 ${-sh-6}`)+hand(-36,-8)+arm(`M48 ${sh+12} q40 10 50 -20`)+hand(98,sh+2);
 else s+=arm(`M-48 ${sh+12} q-14 50 -10 ${-sh+8}`)+arm(`M48 ${sh+12} q14 50 10 ${-sh+8}`)+hand(-58,18)+hand(58,18);
 s+=pHead((o.turn||0)*6,hy,r,o.skin,o.hair,o.mood,o.turn,o.talk,o.bald);
 return s+'</g>'}
// standing, back three-quarter (the coach seen from behind)
function pBack(x,y,o){const sc=o.scale||1;return `<g transform="translate(${x},${y}) scale(${sc})">
 <ellipse cx="0" cy="6" rx="130" ry="20" fill="#000" opacity=".4"/>
 <path d="M-55 -200 l-12 200 h44 l12 -165 l14 165 h44 l-10 -200z" fill="${o.legs||'#14161b'}"/>
 <path d="M-92 -420 q-30 110 -22 230 q60 20 116 16 q56 -2 96 -20 q8 -120 -30 -226 q-80 -34 -160 0z" fill="${o.top||'#1c2029'}"/>
 ${o.pose==='point'?`<path d="M70 -400 q60 -40 110 -120" stroke="${o.top||'#1c2029'}" stroke-width="36" stroke-linecap="round" fill="none"/><circle cx="184" cy="-526" r="12" fill="${o.skin}"/>`:`<path d="M78 -400 q48 50 40 110 q-10 14 -30 4" stroke="${o.top||'#20242e'}" stroke-width="34" stroke-linecap="round" fill="none"/>`}
 <path d="M-90 -400 q-48 50 -40 110 q10 14 30 4" stroke="${o.top||'#1a1e27'}" stroke-width="34" stroke-linecap="round" fill="none"/>
 <path d="M-40 -432 q40 -16 82 0 l-6 24 q-36 -10 -70 0z" fill="rgba(255,255,255,.08)"/>
 <rect x="-18" y="-472" width="38" height="42" rx="12" fill="${o.skin}"/>
 <ellipse cx="-42" cy="-500" rx="8" ry="14" fill="${o.skin}"/><ellipse cx="42" cy="-500" rx="8" ry="14" fill="${o.skin}"/>
 <ellipse cx="0" cy="-508" rx="42" ry="50" fill="${o.hair}"/>
 <path d="M-36 -484 q36 24 72 0 q-4 20 -11 26 q-25 8 -50 0 q-7 -8 -11 -26z" fill="${o.hair}" opacity=".85"/></g>`}
// standing, front (full body)
function pStand(x,y,o){const sc=o.scale||1;let s=`<g transform="translate(${x},${y}) scale(${sc})"><ellipse cx="0" cy="0" rx="60" ry="10" fill="#000" opacity=".35"/>`;
 s+=`<path d="M-30 -160 l-6 160 h26 l8 -130 l8 130 h26 l-6 -160z" fill="${o.legs||'#13213A'}"/>`;
 s+=`<path d="M-46 -280 q46 -14 92 0 l6 130 h-104z" fill="${o.top}"/>`;
 if(o.stripe)s+=`<path d="M-40 -276 v120" stroke="${o.stripe}" stroke-width="3" opacity=".85"/>`;
 if(o.pose==='folded')s+=`<rect x="-48" y="-238" width="96" height="28" rx="13" fill="${o.top}" stroke="rgba(0,0,0,.35)" stroke-width="2"/><circle cx="-40" cy="-224" r="9" fill="${o.skin}"/><circle cx="40" cy="-222" r="9" fill="${o.skin}"/>`;
 else if(o.pose==='clip')s+=`<path d="M40 -270 q20 40 0 70" stroke="${o.top}" stroke-width="18" stroke-linecap="round" fill="none"/><rect x="-10" y="-226" width="44" height="56" fill="#b89a6a"/><rect x="-5" y="-220" width="34" height="44" fill="#EFEBE3"/><path d="M-40 -270 q-10 50 20 70" stroke="${o.top}" stroke-width="18" stroke-linecap="round" fill="none"/>`;
 else s+=`<path d="M-46 -270 q-12 60 -6 110" stroke="${o.top}" stroke-width="18" stroke-linecap="round" fill="none"/><path d="M46 -270 q12 60 6 110" stroke="${o.top}" stroke-width="18" stroke-linecap="round" fill="none"/><circle cx="-52" cy="-158" r="9" fill="${o.skin}"/><circle cx="52" cy="-158" r="9" fill="${o.skin}"/>`;
 s+=pHead((o.turn||0)*6,-326,28,o.skin,o.hair,o.mood,o.turn,o.talk,o.bald);
 return s+'</g>'}
