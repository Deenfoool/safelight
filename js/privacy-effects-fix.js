(function(){
'use strict';
if(window.safelightPrivacySliderFixLoaded)return;window.safelightPrivacySliderFixLoaded=true;
/*
 * privacy-effects owns its live canvas. The generic live editor also listens to
 * inspector input/change events. For the privacy strength slider that caused a
 * race: one renderer hid the live canvas while the other redrew it, which could
 * look like a doubled image. Stop the event before it reaches the generic
 * inspector listener; the privacy tool's document listener still receives it.
 */
function isolate(event){if(event.target?.id==='pe-strength')event.stopPropagation()}
document.addEventListener('input',isolate,true);
document.addEventListener('change',isolate,true);
})();
