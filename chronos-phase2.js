/*
 * CHRONOS Phase 2 — Temporal Vision Engine
 *
 * This module is deliberately additive. It attaches to the existing Phase 1
 * controls instead of replacing the existing media player, timeline, markers,
 * settings, or command console.
 *
 * All temporal processing is local in the browser. The original recording is
 * never uploaded by this module. Fusion/effects use frames actually decoded
 * from the loaded video element.
 */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const video=$('video');
const screen=$('screen');
const rightStack=document.querySelector('.right-stack');
if(!video||!screen||!rightStack)return;

const state={
  frames:[],
  extracted:[],
  effect:'fusion',
  busy:false,
  start:0,
  end:0,
  interval:.25,
  samples:8,
  emphasis:70,
  layerOpacity:[],
  renderToken:0,
  savedTime:0,
  wasPlaying:false,
  measuredFrames:0,
  measureStart:0,
  compareIndex:-1,
  showFusion:true
};

function fmt(t){if(!Number.isFinite(t)||t<0)t=0;const m=Math.floor(t/60),s=Math.floor(t%60),ms=Math.floor((t%1)*1000);return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')+'.'+String(ms).padStart(3,'0')}
function toast(msg){const el=$('toast');if(!el)return;el.textContent=msg;el.classList.add('show');clearTimeout(window.__chronosP2Toast);window.__chronosP2Toast=setTimeout(()=>el.classList.remove('show'),2600)}
function duration(){return Number.isFinite(video.duration)?video.duration:0}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function syncRange(){const d=duration();state.start=clamp(Number($('p2Start')?.value||0),0,d);state.end=clamp(Number($('p2End')?.value||d),state.start,d);if($('p2Start'))$('p2Start').value=state.start.toFixed(2);if($('p2End'))$('p2End').value=state.end.toFixed(2)}

function addPanel(){
 if($('chronosPhase2Panel'))return;
 const panel=document.createElement('section');
 panel.className='panel chronos-phase2-panel';
 panel.id='chronosPhase2Panel';
 panel.innerHTML=`
  <div class="panel-head"><span class="panel-title">Temporal Vision Engine</span><span class="panel-code">PHASE 2</span></div>
  <div class="panel-body">
   <div class="p2-section">
    <div class="p2-section-title">01 / Temporal sampling</div>
    <div class="p2-grid">
     <div class="p2-control"><label for="p2Start">Range start (s)</label><input id="p2Start" type="number" min="0" step="0.01" value="0"></div>
     <div class="p2-control"><label for="p2End">Range end (s)</label><input id="p2End" type="number" min="0" step="0.01" value="0"></div>
     <div class="p2-control"><label for="p2Samples">Samples</label><input id="p2Samples" type="number" min="2" max="32" step="1" value="8"></div>
     <div class="p2-control"><label for="p2Interval">Interval (s)</label><input id="p2Interval" type="number" min="0.01" max="30" step="0.01" value="0.25"></div>
    </div>
    <div class="p2-actions" style="margin-top:5px"><button class="btn primary" id="p2Build">◈ Build fusion</button><button class="btn" id="p2Clear">Clear layers</button></div>
    <div class="p2-status" id="p2Status">Load a recording to enable temporal sampling.</div>
   </div>
   <div class="p2-section">
    <div class="p2-section-title">02 / Temporal effects</div>
    <div class="p2-effect-grid">
     <button class="btn p2-effect active" data-p2-effect="fusion">Temporal Fusion</button>
     <button class="btn p2-effect" data-p2-effect="echo">Time Echo</button>
     <button class="btn p2-effect" data-p2-effect="ghost">Temporal Ghosting</button>
     <button class="btn p2-effect" data-p2-effect="trail">Motion Trails</button>
     <button class="btn p2-effect" data-p2-effect="freeze">Chrono Freeze</button>
     <button class="btn p2-effect" data-p2-effect="stack">Frame Stack</button>
     <button class="btn p2-effect" data-p2-effect="event">Event Highlighting</button>
     <button class="btn p2-effect" data-p2-effect="compare">Frame Comparison</button>
    </div>
    <div class="p2-grid" style="margin-top:5px">
     <div class="p2-control"><label>Visual emphasis <span id="p2EmphasisValue">70%</span></label><input id="p2Emphasis" type="range" min="0" max="100" value="70"></div>
     <div class="p2-control"><label>Layer opacity <span id="p2OpacityValue">65%</span></label><input id="p2Opacity" type="range" min="0" max="100" value="65"></div>
    </div>
   </div>
   <div class="p2-section">
    <button class="btn" id="p2OriginalToggle" style="width:100%;margin-top:5px">◉ Show original source</button>
    <div class="p2-section-title">03 / Extracted frames <span class="chronos-phase2-badge">LOCAL</span></div>
    <div class="p2-control" style="margin-bottom:5px"><label for="p2Annotation">Timestamp annotation (optional)</label><input id="p2Annotation" type="text" maxlength="120" placeholder="Describe this moment…"></div>
     <div class="p2-actions"><button class="btn" id="p2Extract">＋ Extract current frame</button><button class="btn" id="p2ExportFrames">⇩ Export selected</button></div>
     <div class="p2-actions" style="margin-top:4px"><button class="btn" id="p2ExportAll">⇩ Export all frames</button><button class="btn" id="p2CompareLast">◫ Compare last two</button></div>
    <div class="p2-frame-list" id="p2FrameList"><span class="p2-status">No extracted frames.</span></div>
   </div>
   <div class="p2-section">
    <div class="p2-section-title">04 / Layer controls</div>
    <div id="p2Layers"><span class="p2-status">Build a fusion to create temporal layers.</span></div>
   </div>
  </div>`;
 rightStack.appendChild(panel);
 bindPanel();
}

function bindPanel(){
 $('p2Build').onclick=()=>buildFusion();
 $('p2Clear').onclick=()=>clearLayers();
 $('p2Extract').onclick=()=>extractCurrent();
 $('p2ExportFrames').onclick=()=>exportSelectedFrame();
 $('p2ExportAll').onclick=()=>exportAllFrames();
 $('p2CompareLast').onclick=()=>compareLastFrames();
 $('p2OriginalToggle').onclick=()=>{state.showFusion=!state.showFusion;$('p2OriginalToggle').textContent=state.showFusion?'◉ Show original source':'◈ Show temporal fusion';render()};
 $('p2Samples').oninput=e=>{state.samples=clamp(Number(e.target.value)||8,2,32);if($('samples'))$('samples').value=state.samples;$('samplesValue').textContent=state.samples};
 $('p2Interval').oninput=e=>{state.interval=clamp(Number(e.target.value)||.25,.01,30)};
 $('p2Start').onchange=()=>syncRange();
 $('p2End').onchange=()=>syncRange();
 $('p2Emphasis').oninput=e=>{state.emphasis=Number(e.target.value);$('p2EmphasisValue').textContent=state.emphasis+'%';render()};
 $('p2Opacity').oninput=e=>{$('p2OpacityValue').textContent=e.target.value+'%';render()};
 document.querySelectorAll('[data-p2-effect]').forEach(btn=>btn.onclick=()=>{state.effect=btn.dataset.p2Effect;document.querySelectorAll('[data-p2-effect]').forEach(b=>b.classList.toggle('active',b===btn));if(state.effect==='freeze'&&video.src)video.pause();render()});
}

function ensureCanvas(){
 let canvas=$('chronosTemporalCanvas');
 if(!canvas){canvas=document.createElement('canvas');canvas.id='chronosTemporalCanvas';screen.insertBefore(canvas,screen.querySelector('.reticle')||null)}
 return canvas;
}
function canvasSize(canvas){const r=screen.getBoundingClientRect();const w=Math.max(1,Math.floor(r.width*devicePixelRatio));const h=Math.max(1,Math.floor(r.height*devicePixelRatio));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}return {w,h}}
function drawCover(ctx,source,w,h){
 const sw=source.videoWidth||source.width||w,sh=source.videoHeight||source.height||h;
 if(!sw||!sh)return;
 const scale=Math.min(w/sw,h/sh);const dw=sw*scale,dh=sh*scale;const x=(w-dw)/2,y=(h-dh)/2;ctx.drawImage(source,x,y,dw,dh);
}

function seek(t){
 return new Promise(resolve=>{
  const target=clamp(t,0,duration());
  if(Math.abs(video.currentTime-target)<.004){requestAnimationFrame(resolve);return}
  const done=()=>{video.removeEventListener('seeked',done);resolve()};
  video.addEventListener('seeked',done,{once:true});
  video.currentTime=target;
 });
}
async function bitmapFromCurrent(){
 const c=document.createElement('canvas');c.width=video.videoWidth||640;c.height=video.videoHeight||360;const x=c.getContext('2d',{willReadFrequently:false});x.drawImage(video,0,0,c.width,c.height);
 if(window.createImageBitmap){try{return await createImageBitmap(c)}catch(e){}}
 const img=new Image();img.src=c.toDataURL('image/jpeg',.84);await img.decode();return img;
}
async function captureTimes(times){
 if(!video.src||!duration())return [];
 state.busy=true;state.renderToken++;const token=state.renderToken;
 const saved=video.currentTime,playing=!video.paused;
 video.pause();const out=[];
 try{
  for(let i=0;i<times.length;i++){
   if(token!==state.renderToken)break;
   await seek(times[i]);
   const image=await bitmapFromCurrent();
   out.push({time:video.currentTime,image,visible:true,opacity:1});
   if($('p2Status'))$('p2Status').textContent=`Decoded temporal sample ${i+1}/${times.length} · ${fmt(video.currentTime)}`;
  }
 }finally{
  await seek(saved);if(playing)video.play().catch(()=>{});state.busy=false;
 }
 return out;
}

async function buildFusion(){
 if(state.busy)return toast('Temporal sampling is already running.');
 if(!video.src||!duration())return toast('Load a recording first.');
 syncRange();
 const d=duration();
 let start=state.start,end=state.end;
 if(end<=start){end=d;state.end=end;$('p2End').value=end.toFixed(2)}
 const n=clamp(Math.round(state.samples),2,32);
 const interval=Math.max(.01,state.interval);
 const times=[];
 for(let t=start;t<end-0.001&&times.length<n;t=start+times.length*interval){times.push(Number(t.toFixed(3)));}
 if(times.length<n&&(!times.length||end-times[times.length-1]>.001))times.push(Number(end.toFixed(3)));
 else if(times.length>=n&&times.length>1)times[times.length-1]=Number(end.toFixed(3));
 const uniqueTimes=[...new Set(times)].sort((a,b)=>a-b);
 if(uniqueTimes.length<2){return toast('Choose a larger temporal range or interval.');}
 $('p2Build').disabled=true;
 try{
  state.frames=analyzeEvents(await captureTimes(uniqueTimes));
  state.layerOpacity=state.frames.map(()=>1);
  updateLayerUI();
  state.effect=state.effect||'fusion';
  render();
  if($('p2Status'))$('p2Status').textContent=`${state.frames.length} real decoded frames composed · range ${fmt(start)} → ${fmt(end)}`;
  $('temporalChip').textContent='TEMPORAL LAYERS: '+state.frames.length;
  $('layerNote').textContent='Phase 2 active: temporal layers are built from locally decoded frames.';
  toast(`Temporal fusion built from ${state.frames.length} selected moments.`);
 }catch(err){toast('Temporal fusion could not be completed for this recording.');if($('p2Status'))$('p2Status').textContent='Sampling error: '+(err?.message||'unknown error');}
 $('p2Build').disabled=false;
}

function clearLayers(){state.renderToken++;state.frames=[];state.layerOpacity=[];updateLayerUI();render();$('temporalChip').textContent='TEMPORAL LAYERS: 0';if($('p2Status'))$('p2Status').textContent='Temporal layers cleared; original recording remains available.';toast('Temporal layers cleared. Source footage is unchanged.')}
function updateLayerUI(){
 const root=$('p2Layers');if(!root)return;root.replaceChildren();
 if(!state.frames.length){root.innerHTML='<span class="p2-status">Build a fusion to create temporal layers.</span>';return}
 state.frames.forEach((f,i)=>{
  const row=document.createElement('div');row.className='p2-layer';
  const cb=document.createElement('input');cb.type='checkbox';cb.checked=f.visible!==false;cb.title='Show temporal layer '+(i+1);cb.onchange=()=>{f.visible=cb.checked;render()};
  const label=document.createElement('span');label.textContent=`T${i+1} · ${fmt(f.time)}`;
  const val=document.createElement('span');val.textContent=Math.round((state.layerOpacity[i]??1)*100)+'%';
  const range=document.createElement('input');range.type='range';range.min=0;range.max=100;range.value=Math.round((state.layerOpacity[i]??1)*100);range.oninput=()=>{state.layerOpacity[i]=Number(range.value)/100;val.textContent=range.value+'%';render()};
  row.append(cb,label,val,range);root.append(row);
 });
}

function analyzeEvents(frames){
 let previous=null;const scores=[];
 for(const frame of frames){const c=document.createElement('canvas');c.width=24;c.height=24;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(frame.image,0,0,24,24);const pixels=x.getImageData(0,0,24,24).data;let score=0;if(previous){for(let i=0;i<pixels.length;i+=4)score+=(Math.abs(pixels[i]-previous[i])+Math.abs(pixels[i+1]-previous[i+1])+Math.abs(pixels[i+2]-previous[i+2]))/(3*255*576)}frame.eventScore=score;scores.push(score);previous=pixels}
 const sorted=scores.filter(v=>v>0).sort((a,b)=>a-b);const threshold=sorted.length?sorted[Math.floor((sorted.length-1)*.75)]:Infinity;frames.forEach(f=>{if(f.eventScore<threshold)f.eventScore=0});return frames;
}
function render(){
 const canvas=ensureCanvas(),ctx=canvas.getContext('2d');const {w,h}=canvasSize(canvas);ctx.clearRect(0,0,w,h);
 if(!video.src)return;
 if(!state.frames.length&&state.effect!=='compare')return;
 if(!state.showFusion){const originalCanvas=ensureCanvas();const originalCtx=originalCanvas.getContext('2d');const size=canvasSize(originalCanvas);originalCtx.clearRect(0,0,size.w,size.h);return}
 const globalOpacity=(Number($('p2Opacity')?.value||65)/100);const emphasis=state.emphasis/100;
 if(state.effect==='stack'){renderStack(ctx,w,h,globalOpacity);return}
 if(state.effect==='compare'){renderCompare(ctx,w,h,globalOpacity);return}
 const visible=state.frames.filter(f=>f.visible!==false);
 if(!visible.length)return;
 if(state.effect==='freeze'){
  const selected=nearestFrame(video.currentTime);if(selected)drawFrame(ctx,selected.image,w,h,Math.max(.2,emphasis));return;
 }
 if(state.effect==='event'){
  const events=visible.filter(f=>f.eventScore>0);const selected=(events.length?events:visible).reduce((best,f)=>!best||Math.abs(f.time-video.currentTime)<Math.abs(best.time-video.currentTime)?f:best,null);if(selected)drawFrame(ctx,selected.image,w,h,Math.max(.25,emphasis));
  ctx.save();ctx.strokeStyle='rgba(98,244,237,.95)';ctx.lineWidth=Math.max(2,2*devicePixelRatio);ctx.strokeRect(w*.075,h*.075,w*.85,h*.85);ctx.fillStyle='rgba(4,15,20,.82)';ctx.fillRect(w*.075,h*.075,Math.min(w*.36,250*devicePixelRatio),24*devicePixelRatio);ctx.fillStyle='#8ff7ef';ctx.font=`${10*devicePixelRatio}px ui-monospace,monospace`;ctx.fillText('MOTION EVENT Δ '+(selected?(selected.eventScore*100).toFixed(1)+'%':'—')+' · '+(selected?fmt(selected.time):fmt(video.currentTime)),w*.09,h*.075+16*devicePixelRatio);ctx.restore();return;
 }
 const count=visible.length;
 visible.forEach((f,i)=>{
  let alpha=globalOpacity/count;
  if(state.effect==='echo')alpha*=.65+(.35*(i+1)/count);
  if(state.effect==='ghost')alpha*=.75;
  if(state.effect==='trail')alpha*=((i+1)/count);
  const emph=f===nearestFrame(video.currentTime)?emphasis:1;
  drawFrame(ctx,f.image,w,h,Math.min(1,alpha*(.35+.65*emph)));
 });
 // Selected/current moment emphasis marker.
 const nearest=nearestFrame(video.currentTime);if(nearest&&state.effect!=='ghost'){
  ctx.save();ctx.strokeStyle=`rgba(98,244,237,${.25+.65*emphasis})`;ctx.lineWidth=Math.max(1,1.5*devicePixelRatio);ctx.setLineDash([5*devicePixelRatio,5*devicePixelRatio]);ctx.strokeRect(w*.075,h*.075,w*.85,h*.85);ctx.restore();
 }
}
function renderCompare(ctx,w,h,opacity){
 const selected=state.extracted[state.compareIndex]||state.extracted[state.extracted.length-1];
 if(!selected){ctx.save();ctx.fillStyle='rgba(4,15,20,.9)';ctx.fillRect(0,0,w,h);ctx.fillStyle='#8ff7ef';ctx.font=`${12*devicePixelRatio}px ui-monospace,monospace`;ctx.fillText('EXTRACT AT LEAST ONE FRAME',w*.1,h*.5);ctx.restore();return}
 const prior=state.extracted[state.compareIndex-1]||state.frames.reduce((best,f)=>!best||Math.abs(f.time-selected.time)<Math.abs(best.time-selected.time)?f:best,null);
 if(!prior){drawFrame(ctx,selected.image,w,h,opacity);return}
 ctx.save();ctx.beginPath();ctx.rect(0,0,w/2,h);ctx.clip();drawCover(ctx,prior.image,w,h);ctx.restore();
 ctx.save();ctx.beginPath();ctx.rect(w/2,0,w/2,h);ctx.clip();drawCover(ctx,selected.image,w,h);ctx.restore();
 ctx.save();ctx.fillStyle='rgba(2,8,12,.82)';ctx.fillRect(w*.03,h*.04,w*.44,22*devicePixelRatio);ctx.fillRect(w*.53,h*.04,w*.44,22*devicePixelRatio);ctx.fillStyle='#9cefea';ctx.font=`${9*devicePixelRatio}px ui-monospace,monospace`;ctx.fillText('REFERENCE · '+fmt(prior.time),w*.045,h*.04+14*devicePixelRatio);ctx.fillText('SELECTED · '+fmt(selected.time),w*.545,h*.04+14*devicePixelRatio);ctx.strokeStyle='#62f4ed';ctx.lineWidth=Math.max(1,devicePixelRatio);ctx.beginPath();ctx.moveTo(w/2,0);ctx.lineTo(w/2,h);ctx.stroke();ctx.restore();
}
function drawFrame(ctx,image,w,h,alpha){ctx.save();ctx.globalAlpha=clamp(alpha,0,1);drawCover(ctx,image,w,h);ctx.restore()}
function renderStack(ctx,w,h,opacity){
 const frames=state.frames.filter(f=>f.visible!==false);if(!frames.length)return;const cols=Math.ceil(Math.sqrt(frames.length)),rows=Math.ceil(frames.length/cols);const gap=5*devicePixelRatio;const cw=(w-gap*(cols+1))/cols,ch=(h-gap*(rows+1))/rows;
 frames.forEach((f,i)=>{const c=i%cols,r=Math.floor(i/cols);ctx.save();ctx.globalAlpha=opacity*(state.layerOpacity[state.frames.indexOf(f)]??1);ctx.strokeStyle='rgba(98,244,237,.65)';ctx.lineWidth=devicePixelRatio;ctx.strokeRect(gap+c*(cw+gap),gap+r*(ch+gap),cw,ch);ctx.beginPath();ctx.rect(gap+c*(cw+gap),gap+r*(ch+gap),cw,ch);ctx.clip();drawCover(ctx,f.image,cw,ch);ctx.restore();ctx.save();ctx.fillStyle='rgba(2,8,12,.78)';ctx.fillRect(gap+c*(cw+gap),gap+r*(ch+gap),70*devicePixelRatio,14*devicePixelRatio);ctx.fillStyle='#9cefea';ctx.font=`${7*devicePixelRatio}px ui-monospace,monospace`;ctx.fillText(fmt(f.time),gap+4*devicePixelRatio+c*(cw+gap),gap+10*devicePixelRatio+r*(ch+gap));ctx.restore()});
}
function nearestFrame(t){let best=null,delta=Infinity;for(const f of state.frames){const d=Math.abs(f.time-t);if(d<delta&&f.visible!==false){delta=d;best=f}}return best}

async function extractCurrent(){
 if(!video.src)return toast('Load a recording first.');
 const saved=video.currentTime,playing=!video.paused;video.pause();
 try{const image=await bitmapFromCurrent();const annotation=$('p2Annotation')?.value.trim()||'';state.extracted.push({time:saved,image,annotation});state.compareIndex=state.extracted.length-1;if($('p2Annotation'))$('p2Annotation').value='';updateExtractedUI();toast('Current decoded frame extracted locally with timestamp annotation.')}catch(e){toast('Frame extraction failed.')}finally{if(playing)video.play().catch(()=>{});}
}
function updateExtractedUI(){
 const root=$('p2FrameList');if(!root)return;root.replaceChildren();if(!state.extracted.length){root.innerHTML='<span class="p2-status">No extracted frames.</span>';return}
 state.extracted.forEach((f,i)=>{const row=document.createElement('div');row.className='p2-frame';const b=document.createElement('button');b.className='btn';b.textContent='◆ '+fmt(f.time)+(f.annotation?' · '+f.annotation:'');b.title=f.annotation||('Jump to '+fmt(f.time));b.onclick=()=>{video.currentTime=f.time;video.pause();render()};const compare=document.createElement('button');compare.className='btn';compare.textContent='◫';compare.title='Compare this frame';compare.onclick=()=>{state.compareIndex=i;state.effect='compare';document.querySelectorAll('[data-p2-effect]').forEach(btn=>btn.classList.toggle('active',btn.dataset.p2Effect==='compare'));render()};const rm=document.createElement('button');rm.className='btn';rm.textContent='×';rm.title='Remove extracted frame';rm.onclick=()=>{state.extracted.splice(i,1);state.compareIndex=Math.min(state.compareIndex,state.extracted.length-1);updateExtractedUI();render()};row.append(b,compare,rm);root.append(row)});if($('p2CompareLast'))$('p2CompareLast').disabled=state.extracted.length<2;
}
function compareLastFrames(){if(state.extracted.length<2)return toast('Extract at least two frames to compare.');state.compareIndex=state.extracted.length-1;state.effect='compare';document.querySelectorAll('[data-p2-effect]').forEach(btn=>btn.classList.toggle('active',btn.dataset.p2Effect==='compare'));render();toast('Comparing the two most recently extracted frames.');}
function exportAllFrames(){if(!state.extracted.length)return toast('Extract at least one frame first.');const payload=state.extracted.map((f,i)=>({index:i+1,timestampSeconds:f.time,timestamp:fmt(f.time),annotation:f.annotation||'',imageDataUrl:(()=>{const c=document.createElement('canvas');c.width=f.image.width||video.videoWidth||1280;c.height=f.image.height||video.videoHeight||720;c.getContext('2d').drawImage(f.image,0,0,c.width,c.height);return c.toDataURL('image/png')})()}));const blob=new Blob([JSON.stringify({application:'CHRONOS 4D IMAGING',exportedAt:new Date().toISOString(),frames:payload},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='chronos-extracted-frames.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('All extracted frames and timestamp annotations exported as JSON.');}
function exportSelectedFrame(){
 const f=state.extracted[state.extracted.length-1];if(!f)return toast('Extract a frame first.');
 const c=document.createElement('canvas');c.width=f.image.width||video.videoWidth||1280;c.height=f.image.height||video.videoHeight||720;const x=c.getContext('2d');x.drawImage(f.image,0,0,c.width,c.height);const a=document.createElement('a');a.href=c.toDataURL('image/png');a.download='chronos-frame-'+fmt(f.time).replace(/[:.]/g,'-')+'.png';a.click();toast('Extracted frame exported as PNG.');
}

// Phase 2 upgrades existing Phase 1 controls without removing them.
$('fusionBtn').onclick=()=>buildFusion();
$('echoLayer').onchange=e=>{if(e.target.checked){state.effect='echo';document.querySelectorAll('[data-p2-effect]').forEach(b=>b.classList.toggle('active',b.dataset.p2Effect==='echo'));if(!state.frames.length)buildFusion();else render()}else{state.effect='fusion';render()}};
$('samples').oninput=e=>{state.samples=clamp(Number(e.target.value)||8,2,32);$('samplesValue').textContent=state.samples;if($('p2Samples'))$('p2Samples').value=state.samples};
$('intensity').oninput=e=>{$('intensityValue').textContent=e.target.value+'%';document.querySelector('.reticle').style.opacity=String(Number(e.target.value)/100);document.querySelector('.scanline').style.opacity=String(Number(e.target.value)/285);state.emphasis=Number(e.target.value);if($('p2Emphasis'))$('p2Emphasis').value=state.emphasis;render()};

video.addEventListener('loadedmetadata',()=>{
 const d=duration();if($('p2End'))$('p2End').value=d.toFixed(2);state.start=0;state.end=d;
 const status=$('p2Status');if(status)status.textContent=`Source ready · ${video.videoWidth}×${video.videoHeight} · ${fmt(d)} duration · playback FPS is measured while playing.`;if($('fpsStat'))$('fpsStat').textContent='Play to measure';
 render();
});
video.addEventListener('timeupdate',()=>render());
window.addEventListener('resize',()=>render());

// Estimate FPS from decoded frames when the browser exposes requestVideoFrameCallback.
if('requestVideoFrameCallback' in HTMLVideoElement.prototype){
 const sample=(_now,meta)=>{
  if(!state.measureStart)state.measureStart=performance.now();state.measuredFrames++;
  const elapsed=performance.now()-state.measureStart;
  if(elapsed>=900){const fps=state.measuredFrames/(elapsed/1000);if(fps>1&&fps<240){video.dataset.fps=fps.toFixed(2);$('fpsStat').textContent='≈'+fps.toFixed(1)}state.measureStart=0;state.measuredFrames=0;return}
  video.requestVideoFrameCallback(sample);
 };
 video.addEventListener('play',()=>{state.measureStart=0;state.measuredFrames=0;video.requestVideoFrameCallback(sample)},{passive:true});
}

addPanel();
})();
