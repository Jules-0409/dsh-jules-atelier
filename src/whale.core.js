const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const hash=(x,y,k)=>{let h=(x*374761393+y*668265263+k*1442695041)|0;h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296};
const sm=(a,b,v)=>{v=Math.max(0,Math.min(1,(v-a)/(b-a)));return v*v*(3-2*v)};
const RB=' .,:;-=+*#%@', RS=' .·:-=';
let S=null, visible=true;

function build(){
  const css=getComputedStyle(plate), V=n=>css.getPropertyValue(n).trim();
  const C={ink:V('--w-ink'),mid:V('--w-mid'),gold:V('--w-gold'),hi:V('--w-hi'),belly:V('--w-belly'),sea:V('--w-sea')};
  const night=document.body.hasAttribute('data-ds-dark-theme');
  const DPR=Math.max(2,devicePixelRatio||1), Wc=plate.clientWidth, Hc=plate.clientHeight; if(!Wc||!Hc) return;
  cv.width=Wc*DPR; cv.height=Hc*DPR; ctx.setTransform(DPR,0,0,DPR,0,0);
  const FS=Math.max(5.6,Math.min(7.2,Hc/46)); const BOOST=+V('--w-boost')||1; const FONT=`${V('--w-weight')||600} ${FS}px ${V('--f-mono')}`; ctx.font=FONT;
  const CW=ctx.measureText('M').width, CH=FS*1.12;
  const COLS=Math.floor((Wc-40)/CW), ROWS=Math.floor((Hc-34)/CH);
  const X0=(Wc-COLS*CW)/2, Y0=12, WL=Math.round(ROWS*.8);
  const K=3, mw=Math.ceil(COLS*CW*K), mh=Math.ceil(ROWS*CH*K);
  const mk=()=>{const c=document.createElement('canvas');c.width=mw;c.height=mh;return c};
  const m=mk(), mc=m.getContext('2d',{willReadFrequently:true});
  const W=23.16,H=17.04, sc=Math.min(COLS*CW*.7/W,(WL*CH-10)/H);
  const ox=(COLS*CW-W*sc)/2+CW*2, oy=WL*CH-H*sc-CH*.6;
  mc.setTransform(sc*K,0,0,sc*K,ox*K,oy*K); mc.fillStyle='#000'; mc.fill(new Path2D(FISH));
  const blur=r=>{const c=mk(),x=c.getContext('2d',{willReadFrequently:true});x.filter=`blur(${r}px)`;x.drawImage(m,0,0);return x.getImageData(0,0,mw,mh).data};
  const md=mc.getImageData(0,0,mw,mh).data, bd=blur(sc*K*2.4);
  const cov=[],hgt=[];
  for(let r=0;r<ROWS;r++){cov[r]=new Float32Array(COLS);hgt[r]=new Float32Array(COLS);for(let x=0;x<COLS;x++){
    const x0=Math.floor(x*CW*K),x1=Math.floor((x+1)*CW*K),y0=Math.floor(r*CH*K),y1=Math.floor((r+1)*CH*K);let s=0,n=0;
    for(let y=y0;y<y1;y+=2)for(let xx=x0;xx<x1;xx+=2){s+=md[(y*mw+xx)*4+3];n++}
    cov[r][x]=s/(n*255);const cy=Math.floor((r+.5)*CH*K),cx=Math.floor((x+.5)*CW*K);hgt[r][x]=bd[(cy*mw+cx)*4+3]/255}}
  /* enclosed regions → belly (largest) + eye (next) */
  const lab=cov.map(r=>new Int32Array(COLS)), N=[[0,1],[0,-1],[1,0],[-1,0]];
  const fill=(r0,x0,id)=>{const q=[[r0,x0]];lab[r0][x0]=id;let n=0,sx=0,sy=0;while(q.length){const[r,x]=q.pop();n++;sx+=x;sy+=r;for(const[dy,dx]of N){const R=r+dy,X=x+dx;if(R>=0&&R<ROWS&&X>=0&&X<COLS&&!lab[R][X]&&cov[R][X]<.5){lab[R][X]=id;q.push([R,X])}}}return{n,x:sx/n,y:sy/n,id}};
  for(let r=0;r<ROWS;r++)for(let x=0;x<COLS;x++)if((!r||!x||r==ROWS-1||x==COLS-1)&&!lab[r][x]&&cov[r][x]<.5)fill(r,x,-1);
  const comps=[];let id=0;for(let r=0;r<ROWS;r++)for(let x=0;x<COLS;x++)if(!lab[r][x]&&cov[r][x]<.5)comps.push(fill(r,x,++id));
  comps.sort((a,b)=>b.n-a.n); const bellyId=comps[0]?.id, eye=comps[1];
  /* blowhole: lowest point of the notch between dorsal fin and tail */
  const top=x=>{let y=0;while(y<ROWS&&cov[y][x]<.5)y++;return y};
  const fx=Math.round((ox+12*sc)/CW), tx=Math.round((ox+16*sc)/CW); let bhX=fx,bhY=0;
  for(let x=fx;x<=tx;x++){const t=top(x);if(t>bhY&&t<ROWS){bhY=t;bhX=x}} bhX=Math.round(bhX-(bhX-fx)*.35); bhY=top(bhX);
  let minX=COLS,maxX=0,minY=ROWS;for(let r=0;r<ROWS;r++)for(let x=0;x<COLS;x++)if(cov[r][x]>.5){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,r)}
  const cx0=(minX+maxX)/2*CW+X0, cy0=Y0+(minY+WL)/2*CH;
  S={C,BOOST,night,FONT,CW,CH,COLS,ROWS,X0,Y0,WL,Wc,Hc,cov,hgt,lab,bellyId,eye,bhX,bhY,cx0,cy0,
     L:S?.L||{x:cx0-260,y:cy0-260},LT:{x:cx0-260,y:cy0-260},hover:0,hoverT:0,spray:[],bubbles:[],nextSpout:S?S.nextSpout:2.4};
}

function draw(t){
  if(!S) return; const {C,BOOST,FONT,CW,CH,COLS,ROWS,X0,Y0,WL,Wc,Hc,cov,hgt,lab,bellyId,eye,bhX,bhY,cx0,cy0}=S; const s=t/1000;
  S.L.x+=(S.LT.x-S.L.x)*.08;S.L.y+=(S.LT.y-S.L.y)*.08;S.hover+=(S.hoverT-S.hover)*.06; const L=S.L,hover=S.hover;
  ctx.clearRect(0,0,Wc,Hc);
  /* medallion: sun by day, moon by night, sinking behind the sea */
  const R0=Math.min(Wc*.42,Hc*.4), scx=cx0-CW*4, scy=Y0+WL*CH-R0*.55;
  ctx.save();ctx.beginPath();ctx.rect(0,0,Wc,Y0+WL*CH);ctx.clip();
  const gr=ctx.createRadialGradient(scx,scy,0,scx,scy,R0);gr.addColorStop(0,`rgba(${C.hi},.11)`);gr.addColorStop(1,`rgba(${C.hi},0)`);
  ctx.fillStyle=gr;ctx.beginPath();ctx.arc(scx,scy,R0,0,7);ctx.fill();ctx.lineWidth=.6;
  ctx.strokeStyle=`rgba(${C.gold},.38)`;ctx.beginPath();ctx.arc(scx,scy,R0,0,7);ctx.stroke();
  ctx.strokeStyle=`rgba(${C.gold},.2)`;ctx.beginPath();ctx.arc(scx,scy,R0+5,0,7);ctx.stroke();
  for(let i=0;i<120;i++){const a=s*.035+i/120*Math.PI*2,l=i%10?1.6:4.2;ctx.strokeStyle=`rgba(${C.gold},${i%10?.26:.5})`;
    ctx.beginPath();ctx.moveTo(scx+Math.cos(a)*(R0+.5),scy+Math.sin(a)*(R0+.5));ctx.lineTo(scx+Math.cos(a)*(R0+.5+l),scy+Math.sin(a)*(R0+.5+l));ctx.stroke()}
  ctx.restore();
  ctx.font=FONT;ctx.textBaseline='top';
  const put=(ch,x,r,rgb,a)=>{if(ch===' '||a<=.01)return;a*=BOOST;ctx.fillStyle=`rgba(${rgb},${a>1?1:a.toFixed(3)})`;ctx.fillText(ch,X0+x*CW,Y0+r*CH)};
  const mix=(a,b,k)=>{const A=a.split(','),B=b.split(',');return A.map((v,i)=>Math.round(+v+(+B[i]-v)*k)).join(',')};
  const tick=Math.floor(s*2.5), ph=(s%8)/1.9, sheen=ph<1, leaf=S.night;
  const g=(r,x)=>hgt[r<0?0:r>=ROWS?ROWS-1:r][x<0?0:x>=COLS?COLS-1:x];
  for(let r=0;r<WL;r++)for(let x=0;x<COLS;x++){
    const c=cov[r][x], lb=lab[r][x];
    if(c<=.06&&lb<=0)continue;
    const rev=.15+x/COLS*1.1+hash(x,r,7)*.35;
    if(s<rev){if(s>rev-.4&&c>.06)put('#%&$@*+='[Math.floor(hash(x,r,Math.floor(s*20))*8)],x,r,C.mid,.55);continue}
    const gx=(g(r,x+1)-g(r,x-1))*CW*4.5/CW, gy=(g(r+1,x)-g(r-1,x))*CW*4.5/CH;
    const px=X0+(x+.5)*CW,py=Y0+(r+.5)*CH;let lx=L.x-px,ly=L.y-py;const ld=Math.hypot(lx,ly)||1;lx/=ld;ly/=ld;
    let lum=(-gx*lx-gy*ly+.6)/Math.hypot(gx,gy,1)+hover*.45*Math.exp(-(ld*ld)/9800);
    const shine=sheen?Math.exp(-(((x/COLS*.75+(1-r/WL)*.35)-ph*1.3+.15)**2)/.0016):0;
    lum=Math.min(1.2,Math.max(0,lum+shine*.5));
    let ch,col,a;
    if(lb>0&&c<.5){
      if(lb!==bellyId){const on=eye&&Math.round(eye.x)===x&&Math.round(eye.y)===r;ch=on?'@':' ';col=C.hi;a=1}
      else{const d=.3+.45*(1-lum)+shine*.35,h=hash(x,r,5);ch=RS[d>h*.9?Math.min(5,1+Math.floor(d*3.2+h*.6)):0];col=mix(C.belly,C.hi,sm(.6,1,lum));a=.55+.4*d}
    }else{
      let k=Math.round((c<.55?c*1.15:.5+.5*(1-sm(.1,1,lum)))*(RB.length-1)); k=k<1?1:k>11?11:k;
      if(hash(x,r,tick)<.006)k=Math.max(1,Math.min(11,k+(hash(r,x,tick)<.5?-1:1)));
      ch=RB[k];const gk=sm(.5,1.02,lum);col=gk>.55?mix(C.gold,C.hi,(gk-.55)/.45):mix(C.ink,C.gold,gk/.55);
      a=c<.55?.5+c:.82+.18*(1-sm(.3,1,lum));
      if(leaf&&gk>.5){const f=hash(x,r,Math.floor(s*6));if(f<.05){col=C.hi;a=1;ch=f<.015?'*':ch}}   // gold-leaf glints at night
    }
    put(ch,x,r,col,a);
  }
  /* spout — rhythm follows today's token load */
  if(!reduce&&s>S.nextSpout){S.nextSpout=s+D.gap*(.85+hash(1,2,tick)*.3);
    for(let i=0;i<70;i++){const sd=i%2?1:-1,k=hash(i,2,tick);S.spray.push({x:bhX+sd*.4,y:bhY-1,vx:sd*(1.5+k*11),vy:-(17+hash(i,3,tick)*14)*(1-k*.25),t:s+i*.018,b:0})}}
  const sp=S.spray;for(let i=sp.length-1;i>=0;i--){const p=sp[i];if(s<p.t)continue;const dt=1/30;p.vy+=26*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.b+=dt;
    if(p.y>bhY+1||p.b>2.4){sp.splice(i,1);continue}
    put(p.vy<-8?(Math.abs(p.vx)<4?'|':p.vx>0?'/':'\\'):p.vy<4?(p.b>.9?'°':'*'):(p.b>1.4?'.':'·'),Math.round(p.x),Math.round(p.y),p.b<.6?C.gold:C.hi,Math.max(.4,1-p.b*.35))}
  /* bubbles — one stream per running session */
  if(D.running&&!reduce){const bb=S.bubbles;if(bb.length<Math.min(4,D.running)*7&&hash(tick,9,bb.length)<.25)bb.push({x:S.bhX+6+hash(bb.length,4,tick)*10,y:ROWS-1,v:3+hash(bb.length,5,tick)*3});
    for(let i=bb.length-1;i>=0;i--){const b=bb[i];b.y-=b.v/30;if(b.y<WL+.5){bb.splice(i,1);continue}put(b.y>ROWS-4?'.':b.y>WL+3?'o':'°',Math.round(b.x+Math.sin(b.y*.8)*.7),Math.round(b.y),C.hi,.7)}}
  /* sea + reflection */
  for(let x=0;x<COLS;x++){const w=Math.sin(x*.19+s*1.4)+Math.sin(x*.07-s*.8)*.8;put(w>.9?'~':w>-.4?'-':'_',x,WL,C.sea,.75)}
  for(let r=WL+1;r<ROWS;r++){const dd=r-WL,src=WL-1-Math.round((dd-1)*1.25),fade=Math.pow(1-dd/(ROWS-WL+1),1.6);
    for(let x=0;x<COLS;x++){const sx=x+Math.round(Math.sin(r*1.1+s*1.8+x*.05)*1.4),ok=src>=0&&sx>=0&&sx<COLS,c=ok?cov[src][sx]:0,inB=ok&&lab[src][sx]===bellyId;
      if(c>.4&&!inB){if(hash(x,r,Math.floor(s*4))<.78)put(hash(x,r,3)<.5?'=':'-',x,r,C.gold,.7*fade)}
      else if(inB){if((x+r)%3===0)put('.',x,r,C.belly,.35*fade)}
      else{const tw=hash(x,r,Math.floor(s*1.5));if(tw<.012)put(tw<.004?'*':'·',x,r,C.hi,.55*fade);else if(tw<.06)put('.',x,r,C.sea,.35*fade)}}}
}

