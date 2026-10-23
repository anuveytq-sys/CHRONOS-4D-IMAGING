/* CHRONOS rendered-video export — additive helper; does not alter the source or effect controls. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const video=$('video');
const screen=$('screen');
const button=$('extractVideoBtn');
if(!video||!screen||!button)return;
let exporting=false;
const toast=msg=>{const el=$('toast');if(!el){alert(msg);return}el.textContent=msg;el.classList.add('show');clearTimeout(window.__chronosExportToast);window.__chronosExportToast=setTimeout(()=>el.classList.remove('show'),3500)};
const waitForEvent=(target,event)=>new Promise((resolve,reject)=>{const done=()=>{cleanup();resolve()};const fail=()=>{cleanup();reject(new Error('Media playback could not be prepared.'))};const cleanup=()=>{target.removeEventListener(event,done);target.removeEventListener('error',fail)};target.addEventListener(event,done,{once:true});target.addEventListener('error',fail,{once:true})});
button.addEventListener('click',async()=>{
 if(exporting)return;
 if(!video.src||!Number.isFinite(video.duration)||video.duration<=0){toast('Load a video and create your temporal layer first.');return}
 if(!window.MediaRecorder||!HTMLCanvasElement.prototype.captureStream){toast('Rendered video export is not supported in this browser. Try current Chrome or Edge on a computer.');return}
 exporting=true;button.disabled=true;const oldText=button.querySelector('.nav-label');if(oldText)oldText.textContent='Preparing export…';
 const wasPlaying=!video.paused,oldTime=video.currentTime;
 let recorder=null,stream=null,raf=0,stopHandler=null,recorded=[],audioStream=null;
 try{
  video.pause();
  if(video.currentTime!==0){const seeked=waitForEvent(video,'seeked');video.currentTime=0;await seeked}
  const vw=video.videoWidth||1280,vh=video.videoHeight||720;
  // Export in the CHRONOS viewport's aspect ratio. The temporal renderer is
  // sized to #screen (often square), not to the source video's aspect ratio;
  // stretching that canvas into a 16:9 export creates the horizontal-strip
  // corruption visible in exported files.
  const screenRect=screen.getBoundingClientRect();
  const aspect=(screenRect.width>0&&screenRect.height>0)?screenRect.width/screenRect.height:vw/vh;
  const maxSide=1080;
  const outW=Math.max(2,Math.round(aspect>=1?maxSide: maxSide*aspect));
  const outH=Math.max(2,Math.round(aspect>=1?maxSide/aspect:maxSide));
  const canvas=document.createElement('canvas');canvas.width=outW;canvas.height=outH;
  const ctx=canvas.getContext('2d',{alpha:false});
  stream=canvas.captureStream(30);
  // Preserve source audio where the browser exposes a media capture stream.
  const capture=video.captureStream||video.mozCaptureStream;
  if(capture){try{audioStream=capture.call(video);audioStream.getAudioTracks().forEach(track=>stream.addTrack(track))}catch(e){}}
  const mimeTypes=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm','video/mp4'];
  const mimeType=mimeTypes.find(type=>MediaRecorder.isTypeSupported(type));
  if(!mimeType)throw new Error('This browser has no supported video export format.');
  recorder=new MediaRecorder(stream,{mimeType,videoBitsPerSecond:6000000});
  recorder.ondataavailable=e=>{if(e.data&&e.data.size)recorded.push(e.data)};
  const done=new Promise((resolve,reject)=>{recorder.onstop=resolve;recorder.onerror=()=>reject(new Error('Video recording failed.'))});
  // The motion-aware Phase 2 renderer uses chronosMotionCanvas; the older
  // chronosTemporalCanvas is deliberately hidden when that renderer is active.
  // Composite the visible renderer canvas after the source frame so the export
  // matches the actual CHRONOS viewport instead of silently recording raw video.
  const paint=()=>{
   if(!exporting)return;
   try{
    ctx.fillStyle='#020407';ctx.fillRect(0,0,canvas.width,canvas.height);
    // Match the main viewport's video object-fit: contain, then overlay the
    // temporal canvas at the same viewport aspect ratio without stretching.
    if(video.readyState>=2){
      const scale=Math.min(canvas.width/vw,canvas.height/vh);
      const dw=vw*scale,dh=vh*scale;
      ctx.drawImage(video,(canvas.width-dw)/2,(canvas.height-dh)/2,dw,dh);
    }
    const motion=document.getElementById('chronosMotionCanvas');
    const temporal=document.getElementById('chronosTemporalCanvas');
    const layer=motion&&motion.width&&motion.height&&getComputedStyle(motion).display!=='none'
      ?motion:temporal;
    if(layer&&layer.width&&layer.height&&getComputedStyle(layer).display!=='none'){
      ctx.drawImage(layer,0,0,canvas.width,canvas.height);
    }
   }catch(e){}
   raf=requestAnimationFrame(paint);
  };
  paint();
  stopHandler=()=>{if(recorder&&recorder.state!=='inactive')recorder.stop()};
  video.addEventListener('ended',stopHandler,{once:true});
  recorder.start(250);
  await video.play();
  toast('Recording the rendered CHRONOS view. Keep this tab open until export finishes.');
  await done;
  exporting=false;cancelAnimationFrame(raf);
  const blob=new Blob(recorded,{type:mimeType});
  if(!blob.size)throw new Error('The exported video was empty.');
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='chronos-4d-rendered-'+new Date().toISOString().replace(/[:.]/g,'-')+(mimeType.includes('mp4')?'.mp4':'.webm');
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  toast('Rendered 4D video exported. Share the downloaded video file.');
 }catch(err){
  exporting=false;cancelAnimationFrame(raf);
  if(recorder&&recorder.state!=='inactive'){try{recorder.stop()}catch(e){}}
  toast(err&&err.message?err.message:'Could not export the rendered video.');
 }finally{
  exporting=false;cancelAnimationFrame(raf);
  if(stopHandler)video.removeEventListener('ended',stopHandler);
  if(stream)stream.getTracks().forEach(t=>t.stop());
  if(audioStream)audioStream.getTracks().forEach(t=>{try{t.stop()}catch(e){}});
  if(video.src){try{video.currentTime=Math.min(oldTime,video.duration||oldTime)}catch(e){}if(wasPlaying)video.play().catch(()=>{})}
  button.disabled=false;if(oldText)oldText.textContent='Extract rendered video';
 }
});
video.addEventListener('loadedmetadata',()=>{button.disabled=false});
})();
