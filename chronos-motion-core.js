/* CHRONOS Motion-Only Temporal Core
 * Keeps the existing GUI and controls. Stable background + moving-object-only compositor.
 * This revision makes tracked temporal positions more visible without changing the GUI.
 */
(()=>{
'use strict';
const $=id=>document.getElementById(id), video=$('video'), screen=$('screen');
if(!video||!screen||window.__chronosMotionCore)return; window.__chronosMotionCore=true;
const state={frames:[],background:null,effect:'fusion',busy:false,token:0,shifts:[]};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const toast=m=>{const e=$('toast');if(!e)return;e.textContent=m;e.classList.add('show');clearTimeout(window.__chronosMotionToast);window.__chronosMotionToast=setTimeout(()=>e.classList.remove('show'),2800)};
const dur=()=>Number.isFinite(video.duration)?video.duration:0;
const fmt=t=>{t=Math.max(0,Number(t)||0);return String(Math.floor(t/60)).padStart(2,'0')+':'+String(Math.floor(t%60)).padStart(2,'0')+'.'+String(Math.floor((t%1)*1000)).padStart(3,'0')};
function canvasSize(c){const r=screen.getBoundingClientRect(),d=devicePixelRatio||1,w=Math.max(1,Math.floor(r.width*d)),h=Math.max(1,Math.floor(r.height*d));if(c.width!==w||c.height!==h){c.width=w;c.height=h}return{w,h}}
function drawCover(ctx,s,w,h){const sw=s.videoWidth||s.width||w,sh=s.videoHeight||s.height||h;if(!sw||!sh)return;const k=Math.min(w/sw,h/sh),dw=sw*k,dh=sh*k;ctx.drawImage(s,(w-dw)/2,(h-dh)/2,dw,dh)}
function ensure(){let c=$('chronosMotionCanvas');if(!c){c=document.createElement('canvas');c.id='chronosMotionCanvas';Object.assign(c.style,{position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none',zIndex:'4'});if(getComputedStyle(screen).position==='static')screen.style.position='relative';screen.insertBefore(c,screen.querySelector('.reticle')||null)}const old=$('chronosTemporalCanvas');if(old)old.style.display='none';return c}
function seek(t){return new Promise(resolve=>{const target=clamp(t,0,dur());if(Math.abs(video.currentTime-target)<.004){requestAnimationFrame(resolve);return}const done=()=>{video.removeEventListener('seeked',done);resolve()};video.addEventListener('seeked',done,{once:true});video.currentTime=target})}
async function grab(){const sw=video.videoWidth||640,sh=video.videoHeight||360,scale=Math.min(1,480/sw,270/sh);const c=document.createElement('canvas');c.width=Math.max(1,Math.round(sw*scale));c.height=Math.max(1,Math.round(sh*scale));c.getContext('2d').drawImage(video,0,0,c.width,c.height);return window.createImageBitmap?createImageBitmap(c):await new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src=c.toDataURL('image/jpeg',.82)})}
function sampleTimes(){let start=Number($('p2Start')?.value||0),end=Number($('p2End')?.value||dur());if(!(end>start))end=dur();const n=clamp(Math.round(Number($('p2Samples')?.value||$('samples')?.value||8)),2,60);const step=Math.max(.10,Number($('p2Interval')?.value||.25));const out=[];for(let t=start;t<end-.001&&out.length<n;t=start+out.length*step)out.push(Number(t.toFixed(3)));if(out.length<n)out.push(Number(end.toFixed(3)));else if(out.length>1)out[out.length-1]=Number(end.toFixed(3));return [...new Set(out)].sort((a,b)=>a-b)}
function median3(values){values.sort((a,b)=>a-b);return values[Math.floor(values.length/2)]}
/* Estimate global camera translation at low resolution. Background features dominate the score;
   moving subjects are a minority and therefore do not usually steer the camera estimate. */
function smallGray(image){
 const c=document.createElement('canvas');c.width=160;c.height=90;
 const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(image,0,0,160,90);
 const d=x.getImageData(0,0,160,90).data,g=new Uint8Array(160*90);
 for(let p=0,j=0;p<d.length;p+=4,j++)g[j]=(d[p]*.299+d[p+1]*.587+d[p+2]*.114);
 return g;
}
function estimateShift(reference,candidate){
 const a=smallGray(reference),b=smallGray(candidate),W=160,H=90;
 function score(dx,dy){
  let total=0,n=0;
  for(let y=8;y<H-8;y+=4){const yy=y-dy;if(yy<1||yy>=H-1)continue;
   for(let x=8;x<W-8;x+=4){const xx=x-dx;if(xx<1||xx>=W-1)continue;
    total+=Math.abs(a[y*W+x]-b[yy*W+xx]);n++;
   }
  }
  return n?total/n:Infinity;
 }
 let best={dx:0,dy:0,score:Infinity};
 for(let dy=-18;dy<=18;dy+=2)for(let dx=-28;dx<=28;dx+=2){const s=score(dx,dy);if(s<best.score)best={dx,dy,score:s}}
 const coarse={...best};
 for(let dy=coarse.dy-2;dy<=coarse.dy+2;dy++)for(let dx=coarse.dx-2;dx<=coarse.dx+2;dx++){
  if(Math.abs(dx)>32||Math.abs(dy)>22)continue;const s=score(dx,dy);if(s<best.score)best={dx,dy,score:s}
 }
 const baseline=score(0,0);
 return {...best,confidence:baseline>0?(baseline-best.score)/baseline:0};
}
function alignImage(image,reference,shift){
 const sw=image.width||video.videoWidth||640,sh=image.height||video.videoHeight||360;
 const c=document.createElement('canvas');c.width=sw;c.height=sh;
 const x=c.getContext('2d');x.drawImage(reference,0,0,sw,sh);
 // Use the reference frame to fill the small borders revealed by camera translation.
 x.drawImage(image,shift.dx*sw/160,shift.dy*sh/90,sw,sh);
 return c;
}
async function makeBackground(images){
 const sw=images[0]?.width||video.videoWidth||640,sh=images[0]?.height||video.videoHeight||360,scale=Math.min(1,480/sw,270/sh),w=Math.max(160,Math.round(sw*scale)),h=Math.max(90,Math.round(sh*scale));
 const cvs=images.map(img=>{const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);return c});
 const data=cvs.map(c=>c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,w,h).data),out=new ImageData(w,h),scratch=[];
 for(let p=0;p<out.data.length;p+=4){
  for(let ch=0;ch<3;ch++){scratch.length=0;for(let k=0;k<data.length;k++)scratch.push(data[k][p+ch]);out.data[p+ch]=median3(scratch)}
  out.data[p+3]=255;
 }
 const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').putImageData(out,0,0);return c;
}
function makeMotionLayer(image,bg,previous){
 const sw=image.width||video.videoWidth||640,sh=image.height||video.videoHeight||360,mw=bg.width,mh=bg.height;
 const small=document.createElement('canvas');small.width=mw;small.height=mh;
 const sx=small.getContext('2d',{willReadFrequently:true});sx.drawImage(image,0,0,mw,mh);
 const a=sx.getImageData(0,0,mw,mh),b=bg.getContext('2d',{willReadFrequently:true}).getImageData(0,0,mw,mh);
 let prev=null;if(previous){const pc=document.createElement('canvas');pc.width=mw;pc.height=mh;pc.getContext('2d').drawImage(previous,0,0,mw,mh);prev=pc.getContext('2d',{willReadFrequently:true}).getImageData(0,0,mw,mh).data}
 const m=sx.createImageData(mw,mh),raw=new Uint8Array(mw*mh),threshold=56;
 // A camera-facing subject changes scale, so background subtraction alone marks the
 // whole body in every sample and produces a stack of translucent full-body ghosts.
 // Intersect background difference with frame-to-frame change to retain moving edges,
 // waving limbs and actual displacement instead of painting the whole subject repeatedly.
 for(let p=0,j=0;p<a.data.length;p+=4,j++){
  const bgd=(Math.abs(a.data[p]-b.data[p])+Math.abs(a.data[p+1]-b.data[p+1])+Math.abs(a.data[p+2]-b.data[p+2]))/3;
  let delta=255;
  if(prev)delta=(Math.abs(a.data[p]-prev[p])+Math.abs(a.data[p+1]-prev[p+1])+Math.abs(a.data[p+2]-prev[p+2]))/3;
  raw[j]=(bgd>threshold&&(!prev||delta>18))?Math.min(150,Math.max(0,(bgd-threshold)*2.1)*Math.min(1,delta/32)):0;
 }
 // Remove isolated speckles that create a noisy/shimmering 4D surface.
 for(let y=1;y<mh-1;y++)for(let x=1;x<mw-1;x++){
  const i=y*mw+x;let neighbors=0;
  for(let yy=-1;yy<=1;yy++)for(let xx=-1;xx<=1;xx++)if((xx||yy)&&raw[(y+yy)*mw+x+xx]>18)neighbors++;
  const v=neighbors>=2?raw[i]:0,p=i*4;m.data[p]=m.data[p+1]=m.data[p+2]=255;m.data[p+3]=v;
 }
 const mask=document.createElement('canvas');mask.width=mw;mask.height=mh;mask.getContext('2d').putImageData(m,0,0);
 const full=document.createElement('canvas');full.width=sw;full.height=sh;const fx=full.getContext('2d');fx.drawImage(image,0,0,sw,sh);fx.globalCompositeOperation='destination-in';fx.drawImage(mask,0,0,sw,sh);fx.globalCompositeOperation='source-over';return{image:full,mask}
}
async function build(){if(state.busy||!video.src||!dur())return toast(state.busy?'Temporal tracking is already running.':'Load or record a video first.');state.busy=true;const token=++state.token,saved=video.currentTime,playing=!video.paused;video.pause();try{const times=sampleTimes(),images=[];for(let i=0;i<times.length;i++){await seek(times[i]);images.push(await grab());const s=$('p2Status');if(s)s.textContent=`Tracking moving regions ${i+1}/${times.length} · ${fmt(times[i])}`;if(token!==state.token)throw new Error('cancelled')}const reference=images[Math.floor(images.length/2)];
 const aligned=[],shifts=[];
 for(let i=0;i<images.length;i++){
  if(i===Math.floor(images.length/2)){aligned.push(images[i]);shifts.push({dx:0,dy:0,confidence:1});continue}
  const shift=estimateShift(reference,images[i]);shifts.push(shift);
  // Reject implausibly large or low-confidence alignments rather than creating full-frame ghosting.
  const safe=shift.confidence>=.035&&Math.abs(shift.dx)<=26&&Math.abs(shift.dy)<=17?shift:{dx:0,dy:0,confidence:0,rejected:true};
  aligned.push(safe.rejected?alignImage(images[i],reference,{dx:0,dy:0}):alignImage(images[i],reference,safe));
 }
 state.shifts=shifts;state.background=await makeBackground(aligned);
 state.frames=aligned.map((image,i)=>({time:times[i],image,...makeMotionLayer(image,state.background,i?aligned[i-1]:null),visible:true,score:0,alignment:shifts[i]}));state.frames.forEach(f=>{const d=f.mask.getContext('2d',{willReadFrequently:true}).getImageData(0,0,f.mask.width,f.mask.height).data;let sum=0;for(let i=3;i<d.length;i+=4)sum+=d[i];f.score=sum/(255*(d.length/4))});render();const s=$('p2Status');if(s)s.textContent=`${state.frames.length} temporal samples tracked · stable background locked · moving regions only`;const chip=$('temporalChip');if(chip)chip.textContent='TEMPORAL LAYERS: '+state.frames.length;const note=$('layerNote');if(note)note.textContent='Motion-aware temporal layers: stationary background stays stable; moving regions carry the 4D effect.';toast('4D motion trail built: stationary background preserved, moving objects tracked.')}catch(e){if(e.message!=='cancelled'){const s=$('p2Status');if(s)s.textContent='Motion tracking failed: '+(e.message||'unknown error');toast('Could not build the motion-aware 4D trail.')}}finally{await seek(saved);if(playing)video.play().catch(()=>{});state.busy=false}}
function drawMasked(ctx,f,w,h,alpha,filter='none',blend='screen',offsetX=0,offsetY=0,scale=1){if(!f?.image)return;const sw=f.image.width,sh=f.image.height,k=Math.min(w/sw,h/sh)*scale,dw=sw*k,dh=sh*k,x=(w-dw)/2+offsetX,y=(h-dh)/2+offsetY;ctx.save();ctx.globalAlpha=clamp(alpha,0,1);ctx.globalCompositeOperation=blend;ctx.filter=filter;ctx.drawImage(f.image,x,y,dw,dh);ctx.restore()}
function render(){const c=ensure(),ctx=c.getContext('2d');const{w,h}=canvasSize(c);ctx.clearRect(0,0,w,h);if(!video.src||!state.background)return;const opacity=Number($('p2Opacity')?.value??65)/100,emphasis=Number($('p2Emphasis')?.value??$('intensity')?.value??70)/100;drawCover(ctx,state.background,w,h);const frames=state.frames.filter(f=>f.visible!==false);if(!frames.length)return;const now=video.currentTime,current=frames.reduce((a,f)=>!a||Math.abs(f.time-now)<Math.abs(a.time-now)?f:a,null);if(state.effect==='freeze'){drawMasked(ctx,current,w,h,.82+.18*emphasis,'none','source-over');return}if(state.effect==='event'){const strongest=frames.reduce((a,f)=>!a||f.score>a.score?f:a,null);frames.forEach(f=>{if(f!==strongest)drawMasked(ctx,f,w,h,opacity*.12,'saturate(1.08)','screen')});drawMasked(ctx,strongest,w,h,.34+.34*emphasis,'saturate(1.18) contrast(1.04)','screen');return}if(state.effect==='stack'){frames.forEach((f,i)=>{const a=opacity*(.12+.34*(i/(Math.max(1,frames.length-1))))*(i%2?.96:1);drawMasked(ctx,f,w,h,a,'contrast(1.04)','screen')});return}if(state.effect==='ghost'){frames.forEach(f=>{const age=Math.abs(now-f.time),a=opacity*(.10+.34/(1+age*2));drawMasked(ctx,f,w,h,a,'grayscale(1) contrast(1.08)','screen')});return}if(state.effect==='trail'){frames.filter(f=>f.time<=now+.001).forEach(f=>{const age=Math.max(0,now-f.time),a=opacity*(.08+.30/(1+age*2.2));drawMasked(ctx,f,w,h,a,'saturate(1.10) contrast(1.02)','screen')});drawMasked(ctx,current,w,h,.18+.22*emphasis,'saturate(1.08) contrast(1.02)','source-over');return}if(state.effect==='compare')return;if(state.effect==='fusion'){frames.forEach(f=>drawMasked(ctx,f,w,h,opacity*.16,'none','screen'));drawMasked(ctx,current,w,h,.24+.26*emphasis,'none','source-over');return}frames.forEach(f=>{const distance=Math.abs(now-f.time),past=f.time<=now,weight=opacity*(past?.14+.62/(1+distance*2.0):.10+.28/(1+distance*2.8));drawMasked(ctx,f,w,h,weight,'saturate(1.12) contrast(1.08)','screen')});drawMasked(ctx,current,w,h,.30+.34*emphasis,'saturate(1.1)','source-over')}
function bind(){const effects=document.querySelectorAll('[data-p2-effect]');effects.forEach(b=>b.onclick=async()=>{state.effect=b.dataset.p2Effect;effects.forEach(x=>x.classList.toggle('active',x===b));const desc={fusion:'Temporal Fusion — preserves the stable scene while fusing only tracked moving regions.',echo:'Time Echo — combines multiple positions of moving subjects into one translucent temporal image.',ghost:'Temporal Ghosting — creates softer but more visible desaturated afterimages from tracked moving subjects.',trail:'Motion Trails — accumulates a clearly visible tracked path of movement while the background remains locked.',freeze:'Chrono Freeze — freezes one tracked moment over the stable scene.',stack:'Frame Stack — stacks clearly visible discrete moving-object moments over one stable background.',event:'Event Highlighting — emphasizes the strongest tracked movement while keeping the scene stable.',compare:'Frame Comparison — compares extracted moments without altering the temporal composite.'};if($('p2EffectDescription'))$('p2EffectDescription').textContent=desc[state.effect]||desc.fusion;if(state.effect!=='compare'&&!state.frames.length)await build();else render()});['p2Opacity','p2Emphasis'].forEach(id=>$(id)?.addEventListener('input',render));$('p2Build')?.addEventListener('click',build);$('fusionBtn')?.addEventListener('click',build);$('echoLayer')?.addEventListener('change',e=>{if(e.target.checked){state.effect='echo';build()}else{state.effect='fusion';render()}});$('p2Clear')?.addEventListener('click',()=>{state.token++;state.frames=[];state.background=null;state.shifts=[];render();const old=$('chronosTemporalCanvas');if(old)old.style.display='none'});$('p2OriginalToggle')?.addEventListener('click',e=>{const c=ensure();const hidden=c.style.display==='none';c.style.display=hidden?'':'none';e.currentTarget.textContent=hidden?'◉ Show original source':'◈ Show temporal motion'});video.addEventListener('timeupdate',render);video.addEventListener('seeked',render);window.addEventListener('resize',render);ensure()}
bind();
})();
