(function(){
  "use strict";

  if(window.safelightMetadataToolsLoaded)return;
  window.safelightMetadataToolsLoaded=true;

  const $=id=>document.getElementById(id);
  const decoder=new TextDecoder("utf-8",{fatal:false});
  const encoder=new TextEncoder();

  let currentFile=null;
  let currentSourceKind="none"; // file | working | preview
  let report=null;
  let analysisToken=0;
  let previewToken=0;

  const TAGS={
    ifd0:{
      0x010e:"description",0x010f:"make",0x0110:"model",0x0112:"orientation",
      0x011a:"xResolution",0x011b:"yResolution",0x0128:"resolutionUnit",
      0x0131:"software",0x0132:"dateTime",0x013b:"artist",0x8298:"copyright"
    },
    exif:{
      0x829a:"exposureTime",0x829d:"fNumber",0x8827:"iso",
      0x9003:"dateOriginal",0x9004:"dateDigitized",
      0x9201:"shutterSpeed",0x9202:"apertureValue",0x9204:"exposureBias",
      0x9207:"meteringMode",0x9209:"flash",0x920a:"focalLength",
      0x9286:"userComment",0xa001:"colorSpace",0xa002:"pixelWidth",0xa003:"pixelHeight",
      0xa420:"imageUniqueId",0xa430:"cameraOwner",0xa431:"bodySerial",
      0xa433:"lensMake",0xa434:"lensModel",0xa435:"lensSerial"
    }
  };

  const esc=value=>String(value==null?"":value)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#39;");

  function fmtBytes(n){
    n=Number(n)||0;
    if(n<1024)return n+" B";
    if(n<1048576)return(n/1024).toFixed(1)+" KB";
    return(n/1048576).toFixed(2)+" MB";
  }

  function fileNameFallback(){
    return ($("meta-name")?.textContent||"image").trim()||"image";
  }

  function active(){
    return !!document.querySelector("#panel-metadata.active");
  }

  function starts(bytes,pos,text){
    if(pos<0||pos+text.length>bytes.length)return false;
    for(let i=0;i<text.length;i++)if(bytes[pos+i]!==text.charCodeAt(i))return false;
    return true;
  }

  function safeGet(view,method,offset,little){
    try{
      if(offset<0||offset>=view.byteLength)return null;
      if(method==="getUint8")return view.getUint8(offset);
      if(method==="getInt8")return view.getInt8(offset);
      return view[method](offset,little);
    }catch(_){return null}
  }

  function typeSize(type){
    return({1:1,2:1,3:2,4:4,5:8,7:1,9:4,10:8})[type]||0;
  }

  function readAscii(view,pos,count){
    if(pos==null||count<=0||pos+count>view.byteLength)return"";
    const bytes=new Uint8Array(view.buffer,view.byteOffset+pos,count);
    let end=bytes.indexOf(0);
    if(end<0)end=bytes.length;
    return decoder.decode(bytes.subarray(0,end)).trim();
  }

  function decodeUndefined(value){
    if(!Array.isArray(value)||!value.length)return"";
    const bytes=Uint8Array.from(value.filter(v=>Number.isFinite(v)).map(v=>v&255));
    if(!bytes.length)return"";
    let start=0;
    if(bytes.length>=8){
      const prefix=String.fromCharCode(...bytes.subarray(0,8)).replace(/\0/g,"").trim().toUpperCase();
      if(prefix.startsWith("ASCII")||prefix.startsWith("UNICODE")||prefix.startsWith("JIS"))start=8;
    }
    return decoder.decode(bytes.subarray(start)).replace(/\0+$/g,"").trim();
  }

  function readTiffValue(view,base,entry,little,end){
    const type=safeGet(view,"getUint16",entry+2,little);
    const count=safeGet(view,"getUint32",entry+4,little);
    const size=typeSize(type);
    if(!type||count==null||!size||count>100000)return null;
    const total=size*count;
    let pos=entry+8;
    if(total>4){
      const rel=safeGet(view,"getUint32",entry+8,little);
      if(rel==null)return null;
      pos=base+rel;
    }
    if(pos<base||pos+total>Math.min(view.byteLength,end))return null;

    const one=idx=>{
      const p=pos+idx*size;
      if(type===1||type===7)return safeGet(view,"getUint8",p);
      if(type===3)return safeGet(view,"getUint16",p,little);
      if(type===4)return safeGet(view,"getUint32",p,little);
      if(type===9)return safeGet(view,"getInt32",p,little);
      if(type===5||type===10){
        const signed=type===10;
        const num=safeGet(view,signed?"getInt32":"getUint32",p,little);
        const den=safeGet(view,signed?"getInt32":"getUint32",p+4,little);
        if(num==null||den==null||den===0)return null;
        return{num,den,value:num/den};
      }
      return null;
    };

    if(type===2)return readAscii(view,pos,count);
    if(count===1)return one(0);
    const values=[];
    for(let i=0;i<Math.min(count,256);i++)values.push(one(i));
    return values;
  }

  function parseTiff(buffer,tiffOffset,maxLength){
    const view=new DataView(buffer);
    const base=tiffOffset||0;
    const end=Math.min(view.byteLength,base+(maxLength||view.byteLength-base));
    if(base+8>end)return{raw:{},tagCount:0,gps:null};
    const order=String.fromCharCode(view.getUint8(base),view.getUint8(base+1));
    const little=order==="II";
    if(!little&&order!=="MM")return{raw:{},tagCount:0,gps:null};
    if(safeGet(view,"getUint16",base+2,little)!==42)return{raw:{},tagCount:0,gps:null};
    const first=safeGet(view,"getUint32",base+4,little);
    if(first==null)return{raw:{},tagCount:0,gps:null};

    const out={raw:{},tagCount:0,gps:null};
    let exifOffset=null,gpsOffset=null;

    function readIfd(rel,map,bucket){
      if(rel==null)return;
      const pos=base+rel;
      if(pos+2>end)return;
      const count=safeGet(view,"getUint16",pos,little);
      if(count==null||count>1024)return;
      out.tagCount+=count;
      for(let i=0;i<count;i++){
        const entry=pos+2+i*12;
        if(entry+12>end)break;
        const tag=safeGet(view,"getUint16",entry,little);
        if(tag==null)continue;
        const value=readTiffValue(view,base,entry,little,end);
        if(tag===0x8769&&typeof value==="number")exifOffset=value;
        if(tag===0x8825&&typeof value==="number")gpsOffset=value;
        const key=map?.[tag];
        if(key&&value!=null&&value!==""){
          out[key]=key==="userComment"?decodeUndefined(value):value;
          out.raw[bucket+":"+tag.toString(16)]=out[key];
        }
      }
    }

    readIfd(first,TAGS.ifd0,"ifd0");
    if(exifOffset!=null)readIfd(exifOffset,TAGS.exif,"exif");

    if(gpsOffset!=null){
      const gps={};
      const pos=base+gpsOffset;
      if(pos+2<=end){
        const count=safeGet(view,"getUint16",pos,little);
        if(count!=null&&count<=256){
          out.tagCount+=count;
          for(let i=0;i<count;i++){
            const entry=pos+2+i*12;
            if(entry+12>end)break;
            const tag=safeGet(view,"getUint16",entry,little);
            const value=readTiffValue(view,base,entry,little,end);
            if(tag===1)gps.latRef=value;
            else if(tag===2)gps.lat=value;
            else if(tag===3)gps.lonRef=value;
            else if(tag===4)gps.lon=value;
            else if(tag===5)gps.altRef=value;
            else if(tag===6)gps.alt=value;
          }
        }
      }
      const decimal=(parts,ref)=>{
        if(!Array.isArray(parts)||parts.length<3)return null;
        const vals=parts.slice(0,3).map(x=>x&&typeof x==="object"?x.value:Number(x));
        if(vals.some(x=>!Number.isFinite(x)))return null;
        let value=vals[0]+vals[1]/60+vals[2]/3600;
        if(/^[SW]$/i.test(String(ref||"")))value*=-1;
        return value;
      };
      const lat=decimal(gps.lat,gps.latRef),lon=decimal(gps.lon,gps.lonRef);
      const altRaw=gps.alt&&typeof gps.alt==="object"?gps.alt.value:Number(gps.alt);
      if(Number.isFinite(lat)&&Number.isFinite(lon)){
        out.gps={lat,lon,altitude:Number.isFinite(altRaw)?(Number(gps.altRef)===1?-altRaw:altRaw):null};
      }
    }
    return out;
  }

  function mergeExif(target,incoming){
    if(!incoming)return;
    Object.keys(incoming).forEach(key=>{
      if(key==="raw"||key==="tagCount")return;
      if(target[key]==null||target[key]==="")target[key]=incoming[key];
    });
    target.tagCount=(target.tagCount||0)+(incoming.tagCount||0);
    target.raw=Object.assign(target.raw||{},incoming.raw||{});
  }

  function parseJpeg(buffer){
    const view=new DataView(buffer),bytes=new Uint8Array(buffer);
    const out={format:"JPEG",metaBytes:0,containers:[],text:{},exif:{raw:{},tagCount:0},diagnostic:{segments:0}};
    if(bytes.length<4||view.getUint16(0,false)!==0xffd8)return out;
    let pos=2;
    while(pos+1<bytes.length){
      if(bytes[pos]!==0xff){pos++;continue}
      while(pos<bytes.length&&bytes[pos]===0xff)pos++;
      if(pos>=bytes.length)break;
      const marker=bytes[pos++];
      if(marker===0xd9||marker===0xda)break;
      if(marker===0x01||(marker>=0xd0&&marker<=0xd7))continue;
      if(pos+2>bytes.length)break;
      const len=view.getUint16(pos,false);
      if(len<2||pos+len>bytes.length)break;
      const payload=pos+2,payloadLen=len-2;
      out.diagnostic.segments++;
      if(marker===0xe1){
        out.metaBytes+=len+2;
        if(starts(bytes,payload,"Exif\0\0")){
          out.containers.push("EXIF");
          mergeExif(out.exif,parseTiff(buffer,payload+6,payloadLen-6));
        }else if(starts(bytes,payload,"http://ns.adobe.com/xap/1.0/")){
          out.containers.push("XMP");
          out.text.xmp=decoder.decode(bytes.subarray(payload,payload+payloadLen)).slice(0,20000);
        }
      }else if(marker===0xed){
        out.metaBytes+=len+2;out.containers.push("IPTC");
      }else if(marker===0xe2){
        if(starts(bytes,payload,"ICC_PROFILE")){out.metaBytes+=len+2;out.containers.push("ICC")}
      }else if(marker===0xfe){
        out.metaBytes+=len+2;out.containers.push("Комментарий");
        out.text.comment=decoder.decode(bytes.subarray(payload,payload+payloadLen)).replace(/\0+$/g,"").trim();
      }
      pos+=len;
    }
    return out;
  }

  function parsePng(buffer){
    const view=new DataView(buffer),bytes=new Uint8Array(buffer);
    const out={format:"PNG",metaBytes:0,containers:[],text:{},exif:{raw:{},tagCount:0},diagnostic:{chunks:0}};
    if(bytes.length<8||!starts(bytes,1,"PNG"))return out;
    let pos=8;
    while(pos+12<=bytes.length){
      const len=view.getUint32(pos,false);
      const type=String.fromCharCode(bytes[pos+4],bytes[pos+5],bytes[pos+6],bytes[pos+7]);
      const data=pos+8;
      if(len>bytes.length-data-4)break;
      out.diagnostic.chunks++;
      if(type==="eXIf"){
        out.metaBytes+=len+12;out.containers.push("EXIF");
        mergeExif(out.exif,parseTiff(buffer,data,len));
      }else if(type==="tEXt"||type==="iTXt"||type==="zTXt"){
        out.metaBytes+=len+12;out.containers.push(type);
        if(type==="tEXt"){
          const chunk=bytes.subarray(data,data+len),zero=chunk.indexOf(0);
          if(zero>0)out.text[decoder.decode(chunk.subarray(0,zero))]=decoder.decode(chunk.subarray(zero+1));
        }
      }else if(type==="iCCP"||type==="tIME"){
        out.metaBytes+=len+12;out.containers.push(type);
      }
      pos+=len+12;
      if(type==="IEND")break;
    }
    return out;
  }

  function parseWebp(buffer){
    const view=new DataView(buffer),bytes=new Uint8Array(buffer);
    const out={format:"WebP",metaBytes:0,containers:[],text:{},exif:{raw:{},tagCount:0},diagnostic:{chunks:0}};
    if(bytes.length<12||!starts(bytes,0,"RIFF")||!starts(bytes,8,"WEBP"))return out;
    let pos=12;
    while(pos+8<=bytes.length){
      const type=String.fromCharCode(bytes[pos],bytes[pos+1],bytes[pos+2],bytes[pos+3]);
      const len=view.getUint32(pos+4,true),data=pos+8;
      if(len>bytes.length-data)break;
      out.diagnostic.chunks++;
      if(type==="EXIF"){
        out.metaBytes+=len+8;out.containers.push("EXIF");
        const tiff=starts(bytes,data,"Exif\0\0")?data+6:data;
        mergeExif(out.exif,parseTiff(buffer,tiff,len-(tiff-data)));
      }else if(type==="XMP "){
        out.metaBytes+=len+8;out.containers.push("XMP");
        out.text.xmp=decoder.decode(bytes.subarray(data,data+len)).slice(0,20000);
      }else if(type==="ICCP"){
        out.metaBytes+=len+8;out.containers.push("ICC");
      }
      pos+=8+len+(len&1);
    }
    return out;
  }

  function pickFromXmp(text,names){
    if(!text)return"";
    for(const name of names){
      const escaped=name.replace(":","\\:");
      const attr=new RegExp(escaped+"=[\"']([^\"']+)[\"']","i").exec(text);
      if(attr)return attr[1].trim();
      const tag=new RegExp("<"+escaped+"[^>]*>([^<]+)</","i").exec(text);
      if(tag)return tag[1].trim();
    }
    return"";
  }

  function rational(value){
    if(value&&typeof value==="object"&&Number.isFinite(value.value))return value.value;
    const n=Number(value);return Number.isFinite(n)?n:null;
  }

  function normalizeReport(file,parsed,sourceKind){
    const exif=parsed.exif||{},xmp=parsed.text?.xmp||"",text=parsed.text||{};
    const camera=[exif.make,exif.model].filter(Boolean).join(" ").trim();
    const lens=[exif.lensMake,exif.lensModel].filter(Boolean).join(" ").trim();
    const author=exif.artist||pickFromXmp(xmp,["dc:creator","photoshop:AuthorsPosition"])||text.Author||text.author||"";
    const copyright=exif.copyright||pickFromXmp(xmp,["dc:rights","photoshop:Copyright"])||text.Copyright||text.copyright||"";
    const software=exif.software||pickFromXmp(xmp,["xmp:CreatorTool","tiff:Software"])||text.Software||text.software||"";
    const date=exif.dateOriginal||exif.dateTime||pickFromXmp(xmp,["exif:DateTimeOriginal","xmp:CreateDate"])||text.CreationTime||text["Creation Time"]||"";
    const comment=exif.userComment||parsed.text?.comment||text.Comment||text.Description||exif.description||pickFromXmp(xmp,["dc:description"])||"";
    const exposure=rational(exif.exposureTime),aperture=rational(exif.fNumber),focal=rational(exif.focalLength);
    const isoRaw=Array.isArray(exif.iso)?exif.iso[0]:exif.iso,iso=Number(isoRaw);
    const gps=exif.gps||null;
    const sensitive=[gps,author,copyright,date,exif.cameraOwner,exif.bodySerial,exif.lensSerial,exif.imageUniqueId].filter(Boolean).length;
    let risk="safe",riskTitle="Метаданные не найдены";
    if(gps||exif.bodySerial||exif.lensSerial){risk="danger";riskTitle="Найдены чувствительные метаданные"}
    else if(sensitive||camera||lens||software||comment){risk="warn";riskTitle="В файле есть метаданные"}
    const knownFields=[camera,lens,date,author,copyright,software,comment,gps,exif.cameraOwner,exif.bodySerial,exif.lensSerial,exif.imageUniqueId,exposure,aperture,focal,Number.isFinite(iso)?iso:null].filter(v=>v!==null&&v!==undefined&&v!=="").length;
    return{
      file,sourceKind,format:parsed.format||String(file.type||"image").replace("image/","").toUpperCase(),
      size:file.size||0,metadataBytes:parsed.metaBytes||0,containers:[...new Set(parsed.containers||[])],
      tagCount:exif.tagCount||0,knownFields,risk,riskTitle,camera,lens,date,author,copyright,software,comment,gps,
      exposure,aperture,focal,iso:Number.isFinite(iso)?iso:null,orientation:exif.orientation||null,
      cameraOwner:exif.cameraOwner||"",bodySerial:exif.bodySerial||"",lensSerial:exif.lensSerial||"",
      imageUniqueId:exif.imageUniqueId||"",pixelWidth:exif.pixelWidth||null,pixelHeight:exif.pixelHeight||null,
      colorSpace:exif.colorSpace||null,source:parsed
    };
  }

  async function parseFile(file,sourceKind){
    const token=++analysisToken;
    currentFile=file;
    currentSourceKind=sourceKind||"file";
    renderLoading(file);
    try{
      const buffer=await file.arrayBuffer();
      if(token!==analysisToken)return;
      const bytes=new Uint8Array(buffer);
      let parsed;
      if(bytes[0]===0xff&&bytes[1]===0xd8)parsed=parseJpeg(buffer);
      else if(bytes[0]===0x89&&starts(bytes,1,"PNG"))parsed=parsePng(buffer);
      else if(starts(bytes,0,"RIFF")&&starts(bytes,8,"WEBP"))parsed=parseWebp(buffer);
      else parsed={format:String(file.type||"").replace("image/","").toUpperCase()||"НЕИЗВЕСТНО",metaBytes:0,containers:[],text:{},exif:{raw:{},tagCount:0},unsupported:true};
      if(token!==analysisToken)return;
      report=normalizeReport(file,parsed,currentSourceKind);
      render();
    }catch(error){
      if(token!==analysisToken)return;
      console.error("Safelight metadata:",error);
      report=null;
      renderError("Не удалось прочитать байты текущего изображения.");
    }
  }

  async function fileFromPreview(){
    const img=$("previewImg"),src=img?.src||"";
    if(!src)return null;
    const token=++previewToken;
    try{
      const response=await fetch(src,{cache:"no-store"});
      if(!response.ok)throw new Error("HTTP "+response.status);
      const blob=await response.blob();
      if(token!==previewToken||$("previewImg")?.src!==src)return null;
      const name=fileNameFallback();
      return new File([blob],name,{type:blob.type||$("meta-type")?.textContent?.split(" ")[0]||"application/octet-stream",lastModified:Date.now()});
    }catch(error){
      console.warn("Safelight metadata preview source:",error);
      return null;
    }
  }

  async function analyzeCurrent(){
    if(currentSourceKind==="file"&&currentFile)return parseFile(currentFile,"file");
    const file=await fileFromPreview();
    if(file)return parseFile(file,currentSourceKind==="working"?"working":"preview");
    if(currentFile)return parseFile(currentFile,"file");
    report=null;render();
  }

  function row(label,value,sensitive){
    if(value==null||value==="")return"";
    return'<div class="sl-meta-row'+(sensitive?' sensitive':'')+'"><span>'+esc(label)+'</span><b>'+esc(value)+'</b></div>';
  }

  function formatExposure(seconds){
    if(!Number.isFinite(seconds)||seconds<=0)return"";
    if(seconds>=1)return seconds.toFixed(seconds<10?1:0)+" с";
    return"1/"+Math.round(1/seconds)+" с";
  }

  function gpsText(gps){
    if(!gps)return"";
    let value=gps.lat.toFixed(6)+", "+gps.lon.toFixed(6);
    if(Number.isFinite(gps.altitude))value+=" · "+gps.altitude.toFixed(1)+" м";
    return value;
  }

  function renderLoading(file){
    const box=$("sl-meta-tool");if(!box)return;
    box.innerHTML='<div class="sl-meta-empty"><span class="sl-meta-spinner"></span><b>Читаю байты файла</b><small>'+esc(file.name||"текущее изображение")+'</small></div>';
  }

  function renderError(message){
    const box=$("sl-meta-tool");if(!box)return;
    box.innerHTML='<div class="sl-meta-empty error"><b>'+esc(message)+'</b><small>Сам файл остаётся на устройстве.</small></div>';
  }

  function cleanerToggle(key,title,desc,found){
    return'<label class="sl-meta-toggle'+(found?' found':'')+'"><input type="checkbox" data-meta-remove="'+key+'" checked><span><b>'+esc(title)+(found?'<em>найдено</em>':'')+'</b><small>'+esc(desc)+'</small></span><i></i></label>';
  }

  function diagnosticText(r){
    if(r.source?.unsupported)return"Формат распознан как «"+r.format+"», но разбор метаданных для него пока не поддерживается.";
    if(r.containers.length||r.tagCount)return"Парсер работает: найдено контейнеров "+r.containers.length+", EXIF-тегов "+r.tagCount+", распознано полей "+r.knownFields+".";
    return"Парсер проверил "+fmtBytes(r.size)+" файла. Контейнеры EXIF/XMP/IPTC/ICC не обнаружены — в этой копии изображения метаданных действительно нет.";
  }

  function render(){
    const box=$("sl-meta-tool");if(!box)return;
    if(!report){
      box.innerHTML='<div class="sl-meta-empty"><div class="sl-meta-empty-icon">i</div><b>Загрузите изображение</b><small>Safelight прочитает метаданные прямо из байтов JPEG, PNG или WebP.</small></div>';
      return;
    }
    const r=report;
    const shooting=[r.exposure?formatExposure(r.exposure):"",r.aperture?"f/"+r.aperture.toFixed(1):"",Number.isFinite(r.iso)?"ISO "+r.iso:"",r.focal?r.focal.toFixed(r.focal<10?1:0)+" мм":""].filter(Boolean).join(" · ");

    const privacy=row("GPS",gpsText(r.gps),!!r.gps)+row("Владелец камеры",r.cameraOwner,!!r.cameraOwner)+row("Серийный номер камеры",r.bodySerial,!!r.bodySerial)+row("Серийный номер объектива",r.lensSerial,!!r.lensSerial)+row("Image Unique ID",r.imageUniqueId,!!r.imageUniqueId)+row("Автор",r.author,!!r.author)+row("Copyright",r.copyright,!!r.copyright);
    const technical=row("Камера",r.camera)+row("Объектив",r.lens)+row("Параметры",shooting)+row("Дата съёмки",r.date,!!r.date)+row("Программа",r.software)+row("Комментарий",r.comment,!!r.comment)+row("Ориентация",r.orientation)+row("Размер EXIF",r.pixelWidth&&r.pixelHeight?String(r.pixelWidth)+" × "+String(r.pixelHeight):"");
    const riskText=r.risk==="danger"?"Файл содержит данные, которые могут раскрывать место съёмки или конкретное устройство.":r.risk==="warn"?"В файле обнаружена встроенная информация о съёмке или авторстве.":"EXIF/XMP/IPTC с известными приватными полями не обнаружены.";

    box.innerHTML='<div class="sl-meta-risk '+r.risk+'"><div class="sl-meta-risk-icon">'+(r.risk==="danger"?"!":r.risk==="warn"?"i":"✓")+'</div><div><b>'+esc(r.riskTitle)+'</b><span>'+esc(riskText)+'</span></div></div>'+ '<div class="sl-meta-summary"><div><span>Формат</span><b>'+esc(r.format)+'</b></div><div><span>Файл</span><b>'+esc(fmtBytes(r.size))+'</b></div><div><span>Метаданные</span><b>'+esc(fmtBytes(r.metadataBytes))+'</b></div></div>'+ '<div class="sl-meta-export-note">'+esc(diagnosticText(r))+'</div>'+ '<div class="sl-meta-section"><div class="sl-meta-section-title">Приватные данные</div>'+(privacy||'<div class="sl-meta-none">Приватных полей из поддерживаемого набора не найдено.</div>')+'</div>'+ '<div class="sl-meta-section"><div class="sl-meta-section-title">EXIF и технические данные</div>'+(technical||'<div class="sl-meta-none">Известных EXIF-полей не найдено.</div>')+(r.containers.length?'<div class="sl-meta-containers">'+r.containers.map(x=>'<span>'+esc(x)+'</span>').join("")+'</div>':"")+'</div>'+ '<div class="sl-meta-section sl-meta-cleaner"><div class="sl-meta-section-title">Очистка при экспорте</div><p>JPEG может сохранить только выбранные поддерживаемые EXIF-поля. PNG и WebP создаются как новая чистая копия.</p>'+ '<label class="sl-meta-master"><input type="checkbox" id="meta-remove-all" checked><span><b>Удалить все метаданные</b><small>Рекомендуется перед публикацией.</small></span></label>'+ '<div class="sl-meta-toggles">'+ cleanerToggle("gps","Геолокация","GPS-координаты и высота",!!r.gps)+ cleanerToggle("device","Камера и объектив","Модель, владелец и серийные номера",!!(r.camera||r.lens||r.cameraOwner||r.bodySerial||r.lensSerial))+ cleanerToggle("shooting","Параметры съёмки","ISO, выдержка, диафрагма, фокусное",!!shooting)+ cleanerToggle("date","Дата и время","Дата создания снимка",!!r.date)+ cleanerToggle("author","Автор и copyright","Авторство и уникальный ID",!!(r.author||r.copyright||r.imageUniqueId))+ cleanerToggle("software","Программа","Приложение или редактор",!!r.software)+ '</div><div class="sl-meta-export-note" id="sl-meta-clean-note">Экспорт создаст чистую копию без исходных метаданных.</div></div>';
    bindCleaner();
  }

  function bindCleaner(){
    const master=$("meta-remove-all");
    const toggles=[...document.querySelectorAll("#sl-meta-tool [data-meta-remove]")];
    if(!master)return;
    const update=()=>{
      const checked=toggles.filter(el=>el.checked).length;
      master.checked=checked===toggles.length;
      master.indeterminate=checked>0&&checked<toggles.length;
      const note=$("sl-meta-clean-note");if(!note)return;
      note.textContent=checked===toggles.length?"Экспорт создаст чистую копию без исходных метаданных.":checked===0?"JPEG сохранит поддерживаемые EXIF-поля. PNG и WebP всё равно будут чистыми.":"JPEG сохранит только категории, которые не отмечены для удаления.";
    };
    master.addEventListener("change",()=>{toggles.forEach(el=>el.checked=master.checked);update()});
    toggles.forEach(el=>el.addEventListener("change",update));
    update();
  }

  function removalState(){
    const state={gps:true,device:true,shooting:true,date:true,author:true,software:true};
    const controls=[...document.querySelectorAll("#sl-meta-tool [data-meta-remove]")];
    controls.forEach(el=>state[el.dataset.metaRemove]=el.checked);
    return state;
  }

  function asciiBytes(text){return[...encoder.encode(String(text||"")),0]}
  function uintBytes(value,bytes){const arr=new Uint8Array(bytes),view=new DataView(arr.buffer);if(bytes===2)view.setUint16(0,Math.max(0,Math.round(value||0)),true);else if(bytes===4)view.setUint32(0,Math.max(0,Math.round(value||0)),true);else arr[0]=Math.max(0,Math.round(value||0))&255;return[...arr]}
  function rationalBytes(value){if(!Number.isFinite(value))return[];const den=1000000;return[...uintBytes(Math.round(value*den),4),...uintBytes(den,4)]}
  function rationalsBytes(values){return values.flatMap(rationalBytes)}
  function decimalToGps(value){const abs=Math.abs(value),deg=Math.floor(abs),mfloat=(abs-deg)*60,min=Math.floor(mfloat),sec=(mfloat-min)*60;return[deg,min,sec]}
  function makeEntry(tag,type,count,bytes){return{tag,type,count,bytes:Array.from(bytes||[])}}

  function buildExifPayload(meta,remove){
    if(!meta)return null;
    const ifd0=[],exif=[],gps=[],src=meta.source?.exif||{};
    if(!remove.device){
      if(src.make){const b=asciiBytes(src.make);ifd0.push(makeEntry(0x010f,2,b.length,b))}
      if(src.model){const b=asciiBytes(src.model);ifd0.push(makeEntry(0x0110,2,b.length,b))}
      if(meta.cameraOwner){const b=asciiBytes(meta.cameraOwner);exif.push(makeEntry(0xa430,2,b.length,b))}
      if(meta.bodySerial){const b=asciiBytes(meta.bodySerial);exif.push(makeEntry(0xa431,2,b.length,b))}
      if(src.lensMake){const b=asciiBytes(src.lensMake);exif.push(makeEntry(0xa433,2,b.length,b))}
      if(src.lensModel){const b=asciiBytes(src.lensModel);exif.push(makeEntry(0xa434,2,b.length,b))}
      if(meta.lensSerial){const b=asciiBytes(meta.lensSerial);exif.push(makeEntry(0xa435,2,b.length,b))}
    }
    if(!remove.software&&meta.software){const b=asciiBytes(meta.software);ifd0.push(makeEntry(0x0131,2,b.length,b))}
    if(!remove.author){
      if(meta.author){const b=asciiBytes(meta.author);ifd0.push(makeEntry(0x013b,2,b.length,b))}
      if(meta.copyright){const b=asciiBytes(meta.copyright);ifd0.push(makeEntry(0x8298,2,b.length,b))}
      if(meta.imageUniqueId){const b=asciiBytes(meta.imageUniqueId);exif.push(makeEntry(0xa420,2,b.length,b))}
    }
    if(!remove.date&&meta.date){const b=asciiBytes(meta.date);ifd0.push(makeEntry(0x0132,2,b.length,b));exif.push(makeEntry(0x9003,2,b.length,b))}
    if(!remove.shooting){
      if(meta.exposure)exif.push(makeEntry(0x829a,5,1,rationalBytes(meta.exposure)));
      if(meta.aperture)exif.push(makeEntry(0x829d,5,1,rationalBytes(meta.aperture)));
      if(Number.isFinite(meta.iso))exif.push(makeEntry(0x8827,3,1,uintBytes(meta.iso,2)));
      if(meta.focal)exif.push(makeEntry(0x920a,5,1,rationalBytes(meta.focal)));
    }
    if(!remove.gps&&meta.gps){
      const lat=decimalToGps(meta.gps.lat),lon=decimalToGps(meta.gps.lon);
      gps.push(makeEntry(1,2,2,asciiBytes(meta.gps.lat<0?"S":"N")));
      gps.push(makeEntry(2,5,3,rationalsBytes(lat)));
      gps.push(makeEntry(3,2,2,asciiBytes(meta.gps.lon<0?"W":"E")));
      gps.push(makeEntry(4,5,3,rationalsBytes(lon)));
      if(Number.isFinite(meta.gps.altitude)){gps.push(makeEntry(5,1,1,[meta.gps.altitude<0?1:0]));gps.push(makeEntry(6,5,1,rationalBytes(Math.abs(meta.gps.altitude))))}
    }
    if(!ifd0.length&&!exif.length&&!gps.length)return null;
    if(exif.length)ifd0.push(makeEntry(0x8769,4,1,[0,0,0,0]));
    if(gps.length)ifd0.push(makeEntry(0x8825,4,1,[0,0,0,0]));
    ifd0.sort((a,b)=>a.tag-b.tag);exif.sort((a,b)=>a.tag-b.tag);gps.sort((a,b)=>a.tag-b.tag);
    const tableLen=entries=>2+entries.length*12+4,ifd0Offset=8;
    const exifOffset=exif.length?ifd0Offset+tableLen(ifd0):0;
    const gpsOffset=gps.length?ifd0Offset+tableLen(ifd0)+tableLen(exif):0;
    const dataStart=ifd0Offset+tableLen(ifd0)+tableLen(exif)+tableLen(gps);
    ifd0.forEach(entry=>{if(entry.tag===0x8769)entry.bytes=uintBytes(exifOffset,4);if(entry.tag===0x8825)entry.bytes=uintBytes(gpsOffset,4)});
    const extra=[...ifd0,...exif,...gps].reduce((sum,e)=>sum+(e.bytes.length>4?e.bytes.length+(e.bytes.length&1):0),0);
    const tiff=new Uint8Array(dataStart+extra),view=new DataView(tiff.buffer);
    tiff[0]=0x49;tiff[1]=0x49;view.setUint16(2,42,true);view.setUint32(4,ifd0Offset,true);
    let cursor=dataStart;
    function writeIfd(entries,offset){
      if(!entries.length||!offset)return;
      view.setUint16(offset,entries.length,true);
      entries.forEach((entry,index)=>{const p=offset+2+index*12;view.setUint16(p,entry.tag,true);view.setUint16(p+2,entry.type,true);view.setUint32(p+4,entry.count,true);if(entry.bytes.length<=4){for(let i=0;i<4;i++)tiff[p+8+i]=entry.bytes[i]||0}else{view.setUint32(p+8,cursor,true);tiff.set(entry.bytes,cursor);cursor+=entry.bytes.length;if(cursor&1)cursor++}});
      view.setUint32(offset+2+entries.length*12,0,true);
    }
    writeIfd(ifd0,ifd0Offset);writeIfd(exif,exifOffset);writeIfd(gps,gpsOffset);
    const prefix=encoder.encode("Exif\0\0"),payload=new Uint8Array(prefix.length+tiff.length);payload.set(prefix);payload.set(tiff,prefix.length);return payload;
  }

  async function injectExif(jpegBlob,payload){
    if(!payload)return jpegBlob;
    const source=new Uint8Array(await jpegBlob.arrayBuffer());
    if(source.length<4||source[0]!==0xff||source[1]!==0xd8)return jpegBlob;
    const segLen=payload.length+2;if(segLen>65535)return jpegBlob;
    const segment=new Uint8Array(payload.length+4);segment[0]=0xff;segment[1]=0xe1;segment[2]=(segLen>>8)&255;segment[3]=segLen&255;segment.set(payload,4);
    let insert=2;
    if(source.length>6&&source[2]===0xff&&source[3]===0xe0){const len=(source[4]<<8)|source[5];if(len>=2&&4+len<=source.length)insert=4+len}
    const out=new Uint8Array(source.length+segment.length);out.set(source.subarray(0,insert));out.set(segment,insert);out.set(source.subarray(insert),insert+segment.length);return new Blob([out],{type:"image/jpeg"});
  }

  async function canvasFromPreview(){
    const img=$("previewImg");if(!img?.src)throw new Error("Сначала загрузите изображение");
    if(!img.complete||!img.naturalWidth)await new Promise((resolve,reject)=>{const ok=()=>{cleanup();resolve()},bad=()=>{cleanup();reject(new Error("Предпросмотр ещё не готов"))},cleanup=()=>{img.removeEventListener("load",ok);img.removeEventListener("error",bad)};img.addEventListener("load",ok,{once:true});img.addEventListener("error",bad,{once:true})});
    const canvas=document.createElement("canvas");canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;canvas.getContext("2d").drawImage(img,0,0);return canvas;
  }

  function canvasBlob(canvas,type,quality){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("Не удалось подготовить файл")),type,quality))}
  function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000)}
  function baseName(){return(currentFile?.name||fileNameFallback()||"safelight").replace(/\.[^.]+$/," ").trim()||"safelight"}

  async function exportMetadata(format){
    const canvas=await canvasFromPreview(),remove=removalState();
    if(format==="jpeg"){const opaque=document.createElement("canvas");opaque.width=canvas.width;opaque.height=canvas.height;const ctx=opaque.getContext("2d");ctx.fillStyle="#fff";ctx.fillRect(0,0,opaque.width,opaque.height);ctx.drawImage(canvas,0,0);let blob=await canvasBlob(opaque,"image/jpeg",0.94),payload=buildExifPayload(report,remove);if(payload)blob=await injectExif(blob,payload);download(blob,baseName()+"-clean.jpg");return}
    if(format==="webp"){download(await canvasBlob(canvas,"image/webp",0.92),baseName()+"-clean.webp");return}
    if(format==="png"){download(await canvasBlob(canvas,"image/png"),baseName()+"-clean.png");return}
    throw new Error("Выберите JPEG, WebP или PNG");
  }

  function installPanel(){
    const panel=$("panel-metadata");if(!panel)return false;
    const card=panel.querySelector(".panel-card");if(!card)return false;
    if(!$("sl-meta-tool"))card.innerHTML='<div id="sl-meta-tool" class="sl-meta-tool"></div><div class="status-line" id="meta-status"></div>';
    render();return true;
  }

  function captureFile(file){
    if(!file)return;
    if(file.type.startsWith("image/")||/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name||"")){currentFile=file;currentSourceKind="file";parseFile(file,"file")}
  }

  document.addEventListener("change",event=>{if(event.target?.id!=="fileInput")return;const file=event.target.files?.[0];if(file)captureFile(file)},true);
  document.addEventListener("drop",event=>{const file=[...(event.dataTransfer?.files||[])].find(f=>f.type.startsWith("image/")||/\.(jpe?g|png|webp|heic|heif)$/i.test(f.name||""));if(file)captureFile(file)},true);

  window.addEventListener("safelight:source-file",()=>{currentSourceKind="file";if(currentFile)setTimeout(()=>parseFile(currentFile,"file"),0);else setTimeout(analyzeCurrent,0)});
  window.addEventListener("safelight:working-source",()=>{currentSourceKind="working";currentFile=null;analysisToken++;if(active())setTimeout(analyzeCurrent,0)});
  window.addEventListener("safelight:toolchange",event=>{if(event.detail?.page!=="metadata")return;setTimeout(analyzeCurrent,0)});

  const preview=$("previewImg");
  if(preview)new MutationObserver(()=>{if(currentSourceKind==="working"&&active())setTimeout(analyzeCurrent,0)}).observe(preview,{attributes:true,attributeFilter:["src"]});

  window.safelightMetadataExportItems=()=>[{value:"jpeg",label:"JPEG",meta:"выборочная очистка"},{value:"webp",label:"WebP",meta:"чистый файл"},{value:"png",label:"PNG",meta:"чистый файл"}];
  window.safelightMetadataExport=exportMetadata;
  window.safelightAnalyzeMetadataFile=file=>parseFile(file,"file");

  function boot(){
    if(!installPanel()){setTimeout(boot,50);return}
    const input=$("fileInput");
    if(input?.files?.[0])captureFile(input.files[0]);
    else if($("previewImg")?.src)setTimeout(analyzeCurrent,0);
  }
  boot();
})();