/* AOTC case-study shared enhancement */
(function(){
  // 1) scroll progress bar
  var bar=document.createElement('div');bar.className='aotc-accentbar';document.body.appendChild(bar);
  // 1b) fixed studio backdrop — stays anchored so the page reads as copy scrolling past a still stage
  var stage=document.createElement('div');stage.className='aotc-stage';document.body.insertBefore(stage,document.body.firstChild);
  // 2) ghost background word that changes with scroll — language a media buyer signs off on
  var WORDS=['UNDENIABLE','UNFORGETTABLE','TRUSTED','PROVEN','UNSTOPPABLE','IN DEMAND','EARNED','DELIVERED'];
  var ghost=document.createElement('div');ghost.className='aotc-ghost';var gb=document.createElement('b');gb.textContent=WORDS[0];ghost.appendChild(gb);
  document.body.insertBefore(ghost,stage.nextSibling);
  var lastIdx=-1;
  function onScroll(){
    var h=document.documentElement.scrollHeight-window.innerHeight;
    var p=h>0?Math.min(1,Math.max(0,window.scrollY/h)):0;
    bar.style.width=(p*100)+'%';
    var idx=Math.min(WORDS.length-1,Math.floor(p*WORDS.length));
    if(idx!==lastIdx){lastIdx=idx;gb.style.opacity='0';gb.style.transform='translateY(24px)';setTimeout(function(){gb.textContent=WORDS[idx];gb.style.opacity='1';gb.style.transform='translateY(0)';},180);}
    gb.style.transform='translateY('+(-p*22)+'px)';
  }
  window.addEventListener('scroll',onScroll,{passive:true});onScroll();
  // 3) auto-bold OOH-buyer keywords to guide the eye
  var KW=['led the','led','drove','drives','dominated','owned','own the','sold out','sold-out','packed','booked','re-booked','rebooked','guaranteed','verified','unskippable','unmissable','exclusive','share of voice','reach','frequency','impressions','foot traffic','awareness','recall','conversion','converted','ROI','results','outcome','launch','grand opening','turnout','demand','momentum','GPS-verified','proof','trust','trusted','featured','invited','special access','lead position','biggest','remember','remembered','main event','confirmed','delivered','secured','renewed','proven','measurable','documented','on brief','on time','accountable','credibility'];
  var re=new RegExp('\\b('+KW.map(function(k){return k.replace(/[-\/\\^$*+?.()|[\]{}]/g,'\\$&');}).sort(function(a,b){return b.length-a.length;}).join('|')+')\\b','gi');
  var SKIP={SCRIPT:1,STYLE:1,NAV:1,NOSCRIPT:1,CODE:1,H1:1};
  function walk(node){
    for(var i=node.childNodes.length-1;i>=0;i--){
      var c=node.childNodes[i];
      if(c.nodeType===1){
        if(SKIP[c.tagName])continue;
        if(c.tagName==='A'||c.tagName==='BUTTON')continue;
        if(c.classList&&(c.classList.contains('aotc-ghost')||c.classList.contains('aotc-hl')||c.classList.contains('aotc-accentbar')))continue;
        if(c.getAttribute&&c.getAttribute('data-aotc-done'))continue;
        walk(c);
      } else if(c.nodeType===3 && c.nodeValue && c.nodeValue.trim().length>3){
        if(c.parentNode&&(c.parentNode.tagName==='STRONG'||c.parentNode.classList&&c.parentNode.classList.contains('aotc-hl')))continue;
        var txt=c.nodeValue;re.lastIndex=0;
        if(!re.test(txt))continue;
        re.lastIndex=0;var frag=document.createDocumentFragment(),last=0,m,cnt=0;
        while((m=re.exec(txt))&&cnt<3){
          if(m.index>last)frag.appendChild(document.createTextNode(txt.slice(last,m.index)));
          var s=document.createElement('strong');s.className='aotc-hl';s.textContent=m[0];frag.appendChild(s);
          last=m.index+m[0].length;cnt++;
        }
        if(last<txt.length)frag.appendChild(document.createTextNode(txt.slice(last)));
        c.parentNode.replaceChild(frag,c);
      }
    }
  }
  function boldize(){var main=document.querySelector('main')||document.body;walk(main);}
  // 4) reveal-on-scroll: content floats up over the fixed backdrop as it enters view
  function reveal(){
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('aotc-in');io.unobserve(e.target);}});},{threshold:.12,rootMargin:'0px 0px -8% 0px'});
    document.querySelectorAll('section, header').forEach(function(s){io.observe(s);});
  }
  function init(){boldize();reveal();}
  if(document.readyState!=='loading')init();else document.addEventListener('DOMContentLoaded',init);
})();
