/* CHRONOS Motion Core binding cleanup: keep the existing GUI, remove only the old render click handlers that would duplicate the new motion-only engine. */
(()=>{
'use strict';
['p2Build','fusionBtn','echoLayer','p2Clear','p2OriginalToggle'].forEach(id=>{const e=document.getElementById(id);if(e)e.onclick=null});
})();
