// shared helpers for the design mock-ups
const CREST=(fill,stroke,size)=>`<svg width="${size}" height="${size*34/30}" viewBox="0 0 30 34"><path d="M15 1 L28 5 V17 C28 25 22 30 15 33 C8 30 2 25 2 17 V5 Z" fill="${fill}" stroke="${stroke}" stroke-width="1.4"/></svg>`;
const PCF=size=>`<svg width="${size}" height="${size*34/30}" viewBox="0 0 30 34"><path d="M15 1 L28 5 V17 C28 25 22 30 15 33 C8 30 2 25 2 17 V5 Z" fill="#F2B705" stroke="#0B1F3A" stroke-width="1.4"/><path d="M15 8 v18 M9 13 h12 M8.5 20 q6.5 7 13 0" stroke="#0B1F3A" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg>`;
function topbar(active,status,cta){
  const tabs=['Hub','League','Fixtures','|','Squad','Tactics','Training','Scouting','Club','Inbox'];
  document.body.insertAdjacentHTML('afterbegin',`<div class="top">${PCF(28)}<div class="club">Port Calloway FC</div><div class="tabs">${tabs.map(t=>t=='|'?'<div style="width:1px;background:#2A313D;margin:14px 8px"></div>':`<div class="tab ${t==active?'on':''}">${t}</div>`).join('')}</div><div class="status">${status}</div>${cta?`<div class="go">${cta} <kbd>Space</kbd></div>`:''}</div>`);
}
const sm=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t)};
const seg=(px,py,ax,ay,bx,by)=>{const vx=bx-ax,vy=by-ay,t=Math.max(0,Math.min(1,((px-ax)*vx+(py-ay)*vy)/(vx*vx+vy*vy)));return Math.hypot(px-ax-t*vx,py-ay-t*vy)};
function halftone(id,W,H,st,lum,ink){let o='';for(let y=st/2,r=0;y<H;y+=st,r++)for(let x=st/2+(r%2?st/2:0);x<W;x+=st){const rr=(1-lum(x,y))*st*0.62;if(rr>.28)o+=`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rr.toFixed(2)}" fill="${ink||'#141414'}"/>`}document.getElementById(id).innerHTML=o}
// a generic head-and-shoulders print portrait (light from the left)
function portraitLum(W,H,seed){const cx=W/2,hy=H*0.42,hr=W*0.2;return (x,y)=>{let l=0.93-0.1*(y/H);
  const sw=W*0.22+Math.max(0,y-H*0.66)*1.1;if(y>H*0.66&&Math.abs(x-cx)<sw)l=0.2+0.12*sm(cx-sw,cx+sw,x);
  if(Math.abs(x-cx)<W*0.08&&y>H*0.6&&y<H*0.76)l=0.62-0.3*sm(cx-W*0.08,cx+W*0.08,x);
  const head=Math.hypot((x-cx)/hr,(y-hy)/(hr*1.22));if(head<1)l=0.84-0.46*sm(cx-hr,cx+hr,x)-0.2*sm(0.8,1,head);
  const hair=Math.hypot((x-cx)/(hr*1.06),(y-(hy-hr*0.2))/(hr*1.1))<1&&y<hy-hr*0.45+Math.abs(x-cx)*0.5;if(hair)l=0.12+0.1*((seed||0)%3)*0.5+0.1*sm(cx-hr,cx+hr,x);
  return Math.max(.03,Math.min(.97,l))}}
