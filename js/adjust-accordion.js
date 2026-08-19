(function(){
  'use strict';
  if(window.safelightAdjustAccordionLoaded)return;
  window.safelightAdjustAccordionLoaded=true;

  const panel=document.getElementById('panel-adjust');
  if(!panel)return;

  function sectionByTitle(title){
    return [...panel.querySelectorAll('.sl-adjust-section')].find(section=>{
      const label=section.querySelector('.sl-adjust-section-head>span');
      return label?.textContent.trim()===title;
    })||null;
  }

  function sliderRow(id){
    return document.getElementById(id)?.closest('.sl-adjust-slider')||null;
  }

  function makeSection(title,subtitle,nodes){
    const section=document.createElement('div');
    section.className='sl-adjust-section sl-adjust-accordion';
    section.dataset.adjustSection=title.toLowerCase();

    const head=document.createElement('button');
    head.type='button';
    head.className='sl-adjust-section-head sl-adjust-accordion-toggle';
    head.setAttribute('aria-expanded','false');
    head.innerHTML=`<span>${title}</span><span class="sl-adjust-accordion-meta"><small>${subtitle}</small><i aria-hidden="true"></i></span>`;

    const body=document.createElement('div');
    body.className='sl-adjust-accordion-body';
    body.hidden=true;
    nodes.filter(Boolean).forEach(node=>body.appendChild(node));

    section.append(head,body);
    return section;
  }

  function convertSection(section,title,subtitle){
    if(!section)return null;
    const oldHead=section.querySelector('.sl-adjust-section-head');
    const nodes=[...section.children].filter(node=>node!==oldHead);
    const replacement=makeSection(title,subtitle,nodes);
    section.replaceWith(replacement);
    return replacement;
  }

  function setOpen(section,open){
    const toggle=section.querySelector('.sl-adjust-accordion-toggle');
    const body=section.querySelector('.sl-adjust-accordion-body');
    if(!toggle||!body)return;
    section.classList.toggle('open',open);
    toggle.setAttribute('aria-expanded',open?'true':'false');
    body.hidden=!open;
  }

  function openOnly(section){
    panel.querySelectorAll('.sl-adjust-accordion').forEach(item=>setOpen(item,item===section));
  }

  function install(){
    if(panel.dataset.adjustAccordion==='1')return true;
    const light=sectionByTitle('Свет');
    const color=sectionByTitle('Цвет');
    const combined=sectionByTitle('Детали и эффект');
    if(!light||!color||!combined)return false;

    const lightSection=convertSection(light,'Свет','экспозиция и диапазон');
    convertSection(color,'Цвет','баланс и насыщенность');

    const sharp=sliderRow('a-sharp');
    const blur=sliderRow('a-blur');
    const vignette=sliderRow('a-vignette');
    const sepia=sliderRow('a-sepia');
    const gray=document.getElementById('a-gray')?.closest('.sl-adjust-check')||null;

    const details=makeSection('Детали','резкость изображения',[sharp]);
    const effects=makeSection('Эффекты','стилизация изображения',[blur,vignette,sepia,gray]);
    combined.replaceWith(details,effects);

    panel.dataset.adjustAccordion='1';
    panel.addEventListener('click',event=>{
      const toggle=event.target.closest('.sl-adjust-accordion-toggle');
      if(!toggle||!panel.contains(toggle))return;
      event.preventDefault();
      const section=toggle.closest('.sl-adjust-accordion');
      const open=toggle.getAttribute('aria-expanded')==='true';
      if(open)setOpen(section,false);else openOnly(section);
    });

    if(lightSection)openOnly(lightSection);
    return true;
  }

  if(!install()){
    let attempts=0;
    const timer=setInterval(()=>{
      attempts++;
      if(install()||attempts>100)clearInterval(timer);
    },40);
  }
})();
