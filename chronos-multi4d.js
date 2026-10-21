/* CHRONOS Multi 4D Timeline — optional OpenRouter-powered location search and temporal composite.
   Additive only: leaves source video and existing timeline engines intact.
   Results are AI-assisted reconstructions, not evidence of synchronized events. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const video=$('video');
const layerPanel=[...document.querySelectorAll('.right-stack .panel')].find(p=>/Temporal layers/i.test(p.querySelector('.panel-title')?.textContent||''));
if(!video||!layerPanel||$('multi4dPanel'))return;
const key=()=>localStorage.getItem('chronos-openrouter-key')||$('apiKey')?.value.trim()||'';
const toast=message=>{const el=$('toast');if(el){el.textContent=message;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),3200)}};
const panel=document.createElement('section');
panel.id='multi4dPanel';panel.className='multi4d-panel';
panel.innerHTML=`
<div class="multi4d-heading"><span>◈ MULTI 4D TIMELINE</span><span class="multi4d-badge">OPTIONAL AI</span></div>
<p class="multi4d-note">Search for the same place shown in the source video, compare images from different dates, and build an animated temporal composite.</p>
<label class="multi4d-label" for="multi4dContext">Place or search hint (optional)</label>
<input id="multi4dContext" class="multi4d-input" type="text" placeholder="e.g. exact landmark, city, event">
<div class="multi4d-actions"><button type="button" class="btn primary" id="multi4dRun">Multi 4D Timeline</button><button type="button" class="btn" id="multi4dClear">Clear result</button></div>
<div class="multi4d-status" id="multi4dStatus" role="status" aria-live="polite">Ready · Load or pause a video, then start when you choose.</div>
<div id="multi4dResult" class="multi4d-result" hidden>
<div class="multi4d-place" id="multi4dPlace"></div>
<div class="multi4d-stage" id="multi4dStage" aria-label="AI-assisted temporal image reconstruction"></div>
<div class="multi4d-legend">SOURCE FRAME + WEB IMAGE REFERENCES · RECONSTRUCTED COMPOSITE</div>
<div class="multi4d-sources" id="multi4dSources"></div>
<p class="multi4d-disclaimer">This is an AI-assisted visual reconstruction. Dates, location matches, and people/crowd comparisons can be uncertain; it does not prove simultaneous events or recreate a verified historical moment. Use only images you have permission to use.</p>
</div>`;
panel.style.order='999';
layerPanel.appendChild(panel);
const status=m=>{const el=$('multi4dStatus');if(el)el.textContent=m};
const dataURL=()=>{
 try{if(!video.videoWidth||!video.videoHeight)throw Error('Load a video and wait for a frame to appear first.');const c=document.createElement('canvas');c.width=Math.min(video.videoWidth,1024);c.height=Math.round(c.width*video.videoHeight/video.videoWidth);c.getContext('2d').drawImage(video,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.78)}
 catch(e){throw Error(e.message||'Could not read the current video frame.')}
};
const responseText=data=>data?.choices?.[0]?.message?.content||'';
function extractUrls(text){
 const urls=[...(text.matchAll(/https?:\\/\\/[^\\s<>"'\\])}]+/g))].map(m=>m[0].replace(/[.,;]+$/,''));
 return [...new Set(urls)].filter(u=>/^https?:/.test(u)).slice(0,12);
}
async function openRouterJSON(path,body,apiKey){
 const r=await fetch('https://openrouter.ai/api/v1/'+path,{method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json','HTTP-Referer':location.href,'X-Title':'CHRONOS Multi 4D Timeline'},body:JSON.stringify(body)});
 const text=await r.text();let j;try{j=JSON.parse(text)}catch(_){throw Error('OpenRouter returned an unreadable response ('+r.status+').')}
 if(!r.ok)throw Error(j.error?.message||j.message||('OpenRouter request failed ('+r.status+').'));
 return j;
}
async function run(){
 const button=$('multi4dRun');button.disabled=true;
 try{
  const apiKey=key();if(!apiKey)throw Error('Add an OpenRouter API key in Settings, then choose Test Key and Save Key Locally.');
  const frame=dataURL();const hint=$('multi4dContext').value.trim();
  const model=localStorage.getItem('chronos-vision-model-id')||$('visionModelId')?.value.trim()||'google/gemini-2.5-flash';
  status('Step 1/4 · Identifying the place in the current video frame…');
  const vision=await openRouterJSON('chat/completions',{model,plugins:[{id:'web'}],messages:[{role:'user',content:[
   {type:'text',text:'Identify the most likely real-world location/landmark in this image. Then use web search to find the same place in photographs from different dates or periods. Return concise JSON only: {"place":"best match","confidence":"high/medium/low","reason":"visual evidence","images":[{"url":"direct image URL if found","page":"source page URL","date":"date or unknown","caption":"what it depicts"}],"searches":["queries used"]}. Include only actual URLs you found; do not invent URLs. Prefer reputable sources, and if uncertain say so. User hint: '+(hint||'none')+'. Distinguish known facts from guesses.'},
   {type:'image_url',image_url:{url:frame}}
  ]}]},apiKey);
  let raw=responseText(vision);let parsed=null;
  try{parsed=JSON.parse(raw.replace(/^```(?:json)?/i,'').replace(/```$/,'').trim())}catch(_){}
  if(!parsed||typeof parsed!=='object'){
    const start=raw.indexOf('{'),end=raw.lastIndexOf('}');if(start>=0&&end>start){try{parsed=JSON.parse(raw.slice(start,end+1))}catch(_){}}
  }
  const place=parsed?.place||hint||'Possible location match';
  status('Step 2/4 · Checking image references and source pages…');
  let imgs=Array.isArray(parsed?.images)?parsed.images:[];
  imgs=imgs.filter(x=>x&&typeof x.url==='string'&&/^https?:\/\//i.test(x.url)).slice(0,8);
  if(!imgs.length){
   const searchText=raw+'\n'+JSON.stringify(parsed?.searches||[]);
   imgs=extractUrls(searchText).filter(u=>/\\.(jpe?g|png|webp)(\\?|$)/i.test(u)).map(url=>({url,page:url,date:'unknown',caption:'Web image candidate'}));
  }
  const result=$('multi4dResult'),stage=$('multi4dStage'),sources=$('multi4dSources');
  result.hidden=false;$('multi4dPlace').textContent='PLACE MATCH: '+place+' · CONFIDENCE: '+(parsed?.confidence||'unverified');
  stage.replaceChildren();sources.replaceChildren();
  const original=document.createElement('div');original.className='multi4d-frame multi4d-original';
  const srcImg=document.createElement('img');srcImg.src=frame;srcImg.alt='Current frame from your selected video';original.append(srcImg);
  const cap=document.createElement('span');cap.textContent='SOURCE VIDEO · '+(Number(video.currentTime||0).toFixed(2))+'s';original.append(cap);stage.append(original);
  let loaded=0;
  for(const item of imgs){
   const card=document.createElement('a');card.className='multi4d-source';card.href=item.page||item.url;card.target='_blank';card.rel='noopener noreferrer';
   const img=document.createElement('img');img.src=item.url;img.alt=item.caption||'Candidate reference image';img.loading='lazy';
   img.onerror=()=>{card.classList.add('multi4d-unavailable');img.remove();const msg=document.createElement('span');msg.textContent='Image unavailable here';card.prepend(msg)};
   img.onload=()=>{loaded++;const ref=document.createElement('div');ref.className='multi4d-frame multi4d-reference';const copy=img.cloneNode();copy.alt=item.caption||'Reference image';ref.append(copy);const label=document.createElement('span');label.textContent=(item.date||'DATE UNKNOWN')+' · '+(item.caption||'WEB REFERENCE');ref.append(label);stage.append(ref)};
   card.append(img);const label=document.createElement('span');label.textContent=(item.date||'Date unknown')+' — '+(item.caption||'Open source page');card.append(label);sources.append(card);
  }
  if(!imgs.length){
   const empty=document.createElement('p');empty.className='multi4d-note';empty.textContent='The model identified a possible place, but did not return direct image URLs that this browser can display. Try adding a more specific place hint or use a different vision model.';stage.append(empty);
  }
  status('Step 3/4 · Building a layered temporal comparison…');
  stage.classList.add('multi4d-animate');
  const sourceList=Array.isArray(parsed?.searches)?parsed.searches:[];
  if(sourceList.length){const q=document.createElement('p');q.className='multi4d-note';q.textContent='Searches: '+sourceList.join(' · ');sources.append(q)}
  status('Step 4/4 · Ready. '+imgs.length+' web image reference(s) found. '+(parsed?.reason||'Location match is model-estimated.')+' This composite is an animated comparison, not verified 4D capture.');
  result.scrollIntoView({behavior:'smooth',block:'nearest'});
 }catch(e){status('Multi 4D Timeline could not finish: '+(e?.message||String(e)));toast('Multi 4D Timeline needs attention. See its status message.')}
 finally{button.disabled=false}
}
$('multi4dRun').addEventListener('click',run);
$('multi4dClear').addEventListener('click',()=>{const r=$('multi4dResult');r.hidden=true;$('multi4dStage').replaceChildren();$('multi4dSources').replaceChildren();status('Result cleared. Your source video was not changed.');});
})();
