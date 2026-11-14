import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './CmsLayoutManager.css'

const DEFAULTS = {
  content_width:'standard', hero_alignment:'center', hero_size:'large',
  section_spacing:'comfortable', gallery_columns:'3', default_gallery_view:'lista', presentation_mode:'editorial', navigation_mode:'curtain', default_theme:'escuro',
  dark_color_background:'#061522', dark_color_surface:'#0b2943', dark_color_text:'#eff7ff', dark_color_muted:'#a9bdcc', dark_color_accent:'#93c8f2',
  light_color_background:'#f5f2eb', light_color_surface:'#ffffff', light_color_text:'#24231f', light_color_muted:'#77746c', light_color_accent:'#657c62',
  show_bio_image:true, show_bio:true, show_references:true, custom_sections:[],
}
const FIELDS = [
  {group:'composition',name:'content_width',title:'Largura do conteúdo',description:'Define quanto espaço o conteúdo ocupa em telas maiores.',options:[['compact','Enxuto','Mais foco e respiro lateral'],['standard','Equilibrado','Proporção atual'],['wide','Amplo','Mais espaço para imagens']]},
  {group:'composition',name:'hero_alignment',title:'Alinhamento da apresentação',description:'Escolha como o nome e a frase aparecem no topo.',options:[['center','Centralizado','Composição simétrica'],['left','À esquerda','Composição editorial']]},
  {group:'composition',name:'hero_size',title:'Altura da apresentação',description:'Controla o espaço reservado ao cabeçalho inicial.',options:[['compact','Compacta','Chega mais rápido ao conteúdo'],['large','Expandida','Dá destaque à identidade']]},
  {group:'composition',name:'section_spacing',title:'Espaçamento entre seções',description:'Ajusta o ritmo vertical entre as partes do portfólio.',options:[['compact','Compacto','Mais conteúdo na tela'],['comfortable','Confortável','Equilíbrio e respiro'],['spacious','Generoso','Mais espaço entre projetos']]},
  {group:'composition',name:'gallery_columns',title:'Colunas da grade',description:'Número de colunas em telas grandes. Em celulares, a grade continua adaptável.',options:[['2','2 colunas','Imagens maiores'],['3','3 colunas','Equilíbrio'],['4','4 colunas','Visão panorâmica']]},
  {group:'composition',name:'default_gallery_view',title:'Visualização inicial',description:'Como o visitante encontra as obras ao abrir o portfólio.',options:[['lista','Lista editorial','Mais espaço para contexto'],['grade','Grade visual','Acervo em composição única']]},
  {group:'experience',name:'presentation_mode',title:'Forma de explorar as obras',description:'Escolha uma experiência visual diferente da grade ou lista tradicional.',options:[['editorial','Editorial','Composição atual, com lista e grade'],['carousel','Carrossel horizontal','Percorra projetos lateralmente com gesto ou rolagem'],['immersive','Imersivo','Obras em painéis grandes, quase em tela cheia'],['masonry','Mosaico irregular','Galeria com alturas variadas, como um mural']]},
  {group:'experience',name:'navigation_mode',title:'Estilo de navegação',description:'O menu pode ocupar a tela, abrir como dropdown ou surgir como painel lateral.',options:[['curtain','Cortina','Menu em tela cheia com transição'],['dropdown','Dropdown','Menu compacto ancorado no botão'],['sidebar','Painel lateral','Navegação em uma lateral da tela']]},
  {group:'experience',name:'default_theme',title:'Tema inicial',description:'O visitante ainda poderá alternar entre claro e escuro.',options:[['escuro','Escuro','Apresentação imersiva'],['claro','Claro','Apresentação luminosa']]},
  {group:'content',name:'show_bio_image',title:'Imagem da apresentação',description:'Escolha se a foto ou imagem da artista aparece na seção de apresentação.',options:[[true,'Mostrar imagem','Exibe a imagem junto à apresentação'],[false,'Ocultar imagem','Mantém o texto sem a imagem']]},
  {group:'content',name:'show_bio',title:'Texto da biografia',description:'A imagem e o texto podem ser exibidos de forma independente.',options:[[true,'Mostrar biografia','Exibe o texto biográfico'],[false,'Ocultar biografia','Remove o texto da seção']]},
  {group:'content',name:'show_references',title:'Seção de referências',description:'Controla também a entrada Referências na navegação do portfólio.',options:[[true,'Mostrar referências','Exibe a seção e seus links'],[false,'Ocultar referências','Remove a seção e a entrada do menu']]},
]

const LAYOUT_PRESETS = [
  {id:'editorial-current',title:'Editorial contemporâneo',kind:'Modelo atual · portfólio autoral',description:'Preserva o editorial atual: leitura vertical, obras em lista e menu em cortina.',sections:['exhibitions','process'],settings:{content_width:'standard',hero_alignment:'center',hero_size:'large',section_spacing:'comfortable',gallery_columns:'3',default_gallery_view:'lista',presentation_mode:'editorial',navigation_mode:'curtain',default_theme:'escuro'}},
  {id:'visual-artist',title:'Artista visual',kind:'Artes visuais · pintura · escultura',description:'Mosaico irregular para séries e obras de diferentes formatos, com menu em cortina.',sections:['exhibitions','process','services'],settings:{content_width:'wide',hero_alignment:'left',hero_size:'large',section_spacing:'spacious',gallery_columns:'2',default_gallery_view:'grade',presentation_mode:'masonry',navigation_mode:'curtain',default_theme:'escuro'}},
  {id:'illustrator',title:'Ilustração e desenho',kind:'Ilustração · quadrinhos · gravura',description:'Mosaico de ilustrações com alturas variadas e menu dropdown compacto.',sections:['process','services'],settings:{content_width:'wide',hero_alignment:'left',hero_size:'compact',section_spacing:'comfortable',gallery_columns:'3',default_gallery_view:'grade',presentation_mode:'masonry',navigation_mode:'dropdown',default_theme:'claro'}},
  {id:'photographer',title:'Fotografia',kind:'Fotografia · imagem · editorial',description:'Apresentação imersiva em painéis largos, com navegação lateral que não compete com as fotos.',sections:['exhibitions','services'],settings:{content_width:'wide',hero_alignment:'center',hero_size:'compact',section_spacing:'spacious',gallery_columns:'2',default_gallery_view:'grade',presentation_mode:'immersive',navigation_mode:'sidebar',default_theme:'escuro'}},
  {id:'designer',title:'Design e direção de arte',kind:'Design · branding · 3D · motion',description:'Carrossel horizontal para percorrer cases, com menu dropdown e leitura de contexto.',sections:['process','services','press','testimonials'],settings:{content_width:'standard',hero_alignment:'left',hero_size:'large',section_spacing:'comfortable',gallery_columns:'3',default_gallery_view:'lista',presentation_mode:'carousel',navigation_mode:'dropdown',default_theme:'claro'}},
  {id:'tattoo-artist',title:'Tatuador(a)',kind:'Tatuagem · flash · trabalhos cicatrizados',description:'Carrossel de flash e trabalhos em destaque, com acesso rápido ao menu de agendamento.',sections:['tattoo-flash','tattoo-booking','healed-work','guest-spots'],settings:{content_width:'wide',hero_alignment:'left',hero_size:'compact',section_spacing:'compact',gallery_columns:'3',default_gallery_view:'grade',presentation_mode:'carousel',navigation_mode:'dropdown',default_theme:'escuro'}},
  {id:'tattoo-studio',title:'Estúdio de tatuagem',kind:'Estúdio · equipe · agenda',description:'Mosaico de trabalhos, equipe e especialidades, com painel lateral para navegação do estúdio.',sections:['studio-team','tattoo-flash','tattoo-booking','healed-work','guest-spots'],settings:{content_width:'wide',hero_alignment:'center',hero_size:'large',section_spacing:'comfortable',gallery_columns:'3',default_gallery_view:'grade',presentation_mode:'masonry',navigation_mode:'sidebar',default_theme:'escuro'}},
]

const SECTION_TEMPLATES = [
  {type:'exhibitions',title:'Exposições e trajetória',label:'Exposições',intro:'Exposições, formação, residências, prêmios e participações.'},
  {type:'process',title:'Processo criativo',label:'Processo',intro:'Bastidores, etapas, estudos e materiais de criação.'},
  {type:'services',title:'Serviços e encomendas',label:'Serviços',intro:'Trabalhos disponíveis, formatos de contratação e orçamento.'},
  {type:'press',title:'Imprensa e publicações',label:'Imprensa',intro:'Entrevistas, matérias, revistas, vídeos e publicações.'},
  {type:'testimonials',title:'Depoimentos',label:'Depoimentos',intro:'Relatos de clientes, parceiros e instituições.'},
  {type:'tattoo-flash',title:'Flash disponíveis',label:'Flash tattoo',intro:'Desenhos prontos, disponibilidade e informações para reservar.'},
  {type:'tattoo-booking',title:'Agendamento de tatuagem',label:'Agendamento',intro:'Como solicitar orçamento, enviar referências e agendar.'},
  {type:'healed-work',title:'Trabalhos cicatrizados',label:'Cicatrizados',intro:'Resultados após a cicatrização, separados dos trabalhos recentes.'},
  {type:'guest-spots',title:'Agenda e guest spots',label:'Agenda',intro:'Datas, cidades e estúdios onde o artista estará atendendo.'},
  {type:'studio-team',title:'Estúdio e equipe',label:'Equipe',intro:'Apresentação do estúdio e dos artistas que fazem parte dele.'},
]

const FIELD_GROUPS = [
  {id:'composition',title:'Composição',description:'Defina a estrutura visual e o ritmo de leitura do portfólio.'},
  {id:'content',title:'Conteúdo e seções',description:'Escolha quais partes da apresentação ficam visíveis para o visitante.'},
  {id:'experience',title:'Experiência do visitante',description:'Defina como o portfólio será apresentado na primeira visita.'},
]
const COLOR_FIELDS = [
  ['color_background','Fundo','Plano de fundo geral'],['color_surface','Superfícies','Cartões e áreas elevadas'],
  ['color_text','Texto principal','Títulos e informações principais'],['color_muted','Texto secundário','Legendas e informações auxiliares'],
  ['color_accent','Destaque','Links e elementos ativos'],
]
const PALETTES = [
  {name:'Azul profundo',darkColors:['#061522','#0b2943','#eff7ff','#a9bdcc','#93c8f2'],lightColors:['#edf4f8','#ffffff','#1b2b36','#617482','#3c7196']},
  {name:'Oliva e papel',darkColors:['#171912','#292d20','#f1efdf','#b9b99f','#c5cf91'],lightColors:['#f4f3e9','#ffffff','#292d20','#777866','#657c62']},
  {name:'Terracota',darkColors:['#211815','#382720','#fff0e5','#cdb8aa','#d98d68'],lightColors:['#fbf1eb','#fffaf7','#382720','#806f67','#ad6246']},
  {name:'Galeria clara',darkColors:['#1e2420','#303b34','#f4f2e9','#b7c0b5','#9db58a'],lightColors:['#f5f2eb','#ffffff','#24231f','#77746c','#657c62']},
]
const PREVIEW_DEVICES = { desktop: { label:'Desktop', width:1440, height:900 }, tablet: { label:'Tablet', width:768, height:1024 }, mobile: { label:'Celular', width:390, height:844 } }
function buildPresetSettings(base,preset){
  const stamp=Date.now().toString(36)
  const existing=(base.custom_sections||[]).filter(section=>!String(section.id).startsWith('preset-'))
  const additions=(preset.sections||[]).map((type,index)=>{
    const template=SECTION_TEMPLATES.find(item=>item.type===type)
    return template?{id:'preset-'+preset.id+'-'+type+'-'+stamp+'-'+index,type,title:template.title,intro:template.intro,items:[]}:null
  }).filter(Boolean)
  return {...base,...preset.settings,custom_sections:[...existing,...additions].slice(0,10)}
}

function readCookie(name){const prefix=name+'=';const item=document.cookie.split('; ').find(cookie=>cookie.startsWith(prefix));return item?decodeURIComponent(item.slice(prefix.length)):''}
function luminance(hex){const channels=hex.replace('#','').match(/.{2}/g).map(value=>parseInt(value,16)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722}
function contrastRatio(a,b){const values=[luminance(a),luminance(b)].sort((x,y)=>y-x);return(values[0]+.05)/(values[1]+.05)}
function blendColor(from,to,amount){const a=from.match(/[0-9a-f]{2}/gi).map(value=>parseInt(value,16));const b=to.match(/[0-9a-f]{2}/gi).map(value=>parseInt(value,16));return '#'+a.map((value,index)=>Math.round(value+(b[index]-value)*amount).toString(16).padStart(2,'0')).join('')}
function accessibleColor(foreground,background,minimum=4.5){
  if(contrastRatio(foreground,background)>=minimum)return foreground
  const target=contrastRatio('#000000',background)>=contrastRatio('#ffffff',background)?'#000000':'#ffffff'
  let low=0,high=1
  for(let step=0;step<22;step++){const middle=(low+high)/2;if(contrastRatio(blendColor(foreground,target,middle),background)>=minimum)high=middle;else low=middle}
  return blendColor(foreground,target,high)
}

export function CmsLayoutManager(){
  const [settings,setSettings]=useState(DEFAULTS),[saved,setSaved]=useState(DEFAULTS),[canChange,setCanChange]=useState(false)
  const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
  const [previewOpen,setPreviewOpen]=useState(false)
  const [previewingPresetId,setPreviewingPresetId]=useState(null)
  const presetSectionRef=useRef(null)
  const postPresetMenuRef=useRef(null)
  const inlinePreviewSectionRef=useRef(null)
  const [previewMaximized,setPreviewMaximized]=useState(false)
  const [previewPosition,setPreviewPosition]=useState({x:24,y:108})
  const [previewSize,setPreviewSize]=useState({width:820,height:720})
  const previewDragRef=useRef(null)
  const previewResizeRef=useRef(null)
  const inlinePreviewIframeRef=useRef(null)
  const inlinePreviewViewportRef=useRef(null)
  const [previewDevice,setPreviewDevice]=useState('desktop')
  const [previewFocus,setPreviewFocus]=useState('page')
  const [previewMode,setPreviewMode]=useState(DEFAULTS.default_gallery_view)
  const [editingTheme,setEditingTheme]=useState('dark')
  const [previewContainerSize,setPreviewContainerSize]=useState({width:0,height:0})
  const [previewDocumentHeights,setPreviewDocumentHeights]=useState({floating:PREVIEW_DEVICES.desktop.height,inline:PREVIEW_DEVICES.desktop.height})
  const previewDocumentHeight=previewDocumentHeights.floating
  const inlinePreviewDocumentHeight=previewDocumentHeights.inline
  const previewDocumentObserversRef=useRef(new Map())
  const [inlinePreviewSize,setInlinePreviewSize]=useState({width:0,height:0})
  const [hoverPreviewMounted,setHoverPreviewMounted]=useState(false)
  const [hoveredOption,setHoveredOption]=useState(null)
  const [hoverPreviewSize,setHoverPreviewSize]=useState({width:0,height:0})
  const [hoverPreviewPosition,setHoverPreviewPosition]=useState({left:16,top:16})
  const hoverPreviewIframeRef=useRef(null)
  const hoverPreviewViewportRef=useRef(null)
  const hoverPreviewHideTimerRef=useRef(null)
  const previewViewportRef=useRef(null)
  const previewIframeRef=useRef(null)
  const previewWidth=PREVIEW_DEVICES[previewDevice].width
  const previewHeight=PREVIEW_DEVICES[previewDevice].height
  // A escala é limitada pela largura disponível; a altura permanece rolável.
  const previewScale=previewContainerSize.width>0?Math.min(1,previewContainerSize.width/previewWidth):1
  const previewStageWidth=previewWidth*previewScale
  const previewStageHeight=previewDocumentHeight*previewScale
  // Mantém o viewport lógico do dispositivo e reduz a página inteira pela largura disponível.
  const inlinePreviewScale=inlinePreviewSize.width>0?Math.min(1,inlinePreviewSize.width/previewWidth):1
  const inlinePreviewStageWidth=previewWidth*inlinePreviewScale
  const inlinePreviewStageHeight=inlinePreviewDocumentHeight*inlinePreviewScale
  // Na prévia contextual, priorize a largura para manter o viewport de celular legível.
  const hoverPreviewScale=Math.min(1,(hoverPreviewSize.width||360)/previewWidth)
  const hoverPreviewStageWidth=previewWidth*hoverPreviewScale
  const hoverPreviewStageHeight=previewHeight*hoverPreviewScale
  const startPreviewDrag=event=>{
    if(event.button!==0||event.target.closest('button'))return
    const rect=event.currentTarget.closest('.cms-layout-preview-panel').getBoundingClientRect()
    previewDragRef.current={pointerId:event.pointerId,offsetX:event.clientX-rect.left,offsetY:event.clientY-rect.top}
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }
  const movePreviewDrag=event=>{
    const drag=previewDragRef.current
    if(!drag||drag.pointerId!==event.pointerId||previewMaximized)return
    const width=event.currentTarget.closest('.cms-layout-preview-panel').offsetWidth
    const height=event.currentTarget.closest('.cms-layout-preview-panel').offsetHeight
    setPreviewPosition({x:Math.max(8,Math.min(window.innerWidth-width-8,event.clientX-drag.offsetX)),y:Math.max(8,Math.min(window.innerHeight-height-8,event.clientY-drag.offsetY))})
  }
  const stopPreviewDrag=event=>{if(previewDragRef.current?.pointerId===event.pointerId)previewDragRef.current=null}
  const startPreviewResize=event=>{
    if(event.button!==0)return
    event.preventDefault()
    previewResizeRef.current={pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,width:previewSize.width,height:previewSize.height}
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }
  const movePreviewResize=event=>{
    const start=previewResizeRef.current
    if(!start||start.pointerId!==event.pointerId)return
    setPreviewSize({
      width:Math.max(320,Math.min(window.innerWidth-previewPosition.x-8,start.width+event.clientX-start.startX)),
      height:Math.max(360,Math.min(window.innerHeight-previewPosition.y-8,start.height+event.clientY-start.startY))
    })
  }
  const stopPreviewResize=event=>{if(previewResizeRef.current?.pointerId===event.pointerId)previewResizeRef.current=null}
  // Mantém a janela e seu puxador dentro do viewport, inclusive na abertura e após resize.
  useLayoutEffect(()=>{
    if(!previewOpen||previewMaximized)return
    const clampPreviewPosition=()=>{
      const maxWidth=Math.min(previewSize.width,window.innerWidth-16)
      const maxHeight=Math.min(previewSize.height,window.innerHeight-16)
      setPreviewPosition(current=>{
        const next={
          x:Math.max(8,Math.min(current.x,window.innerWidth-maxWidth-8)),
          y:Math.max(8,Math.min(current.y,window.innerHeight-maxHeight-8)),
        }
        return next.x===current.x&&next.y===current.y?current:next
      })
    }
    clampPreviewPosition()
    window.addEventListener('resize',clampPreviewPosition)
    return()=>window.removeEventListener('resize',clampPreviewPosition)
  },[previewOpen,previewMaximized,previewPosition.x,previewPosition.y,previewSize.width,previewSize.height])

  const observePreviewDocument=frame=>{
    if(!frame?.contentDocument)return
    const doc=frame.contentDocument
    const update=()=>{
      const height=Math.ceil(Math.max(
        doc.documentElement?.scrollHeight||0,
        doc.documentElement?.offsetHeight||0,
        doc.body?.scrollHeight||0,
        doc.body?.offsetHeight||0
      ))
      if(height>0){
        const key=frame===inlinePreviewIframeRef.current?'inline':'floating'
        setPreviewDocumentHeights(current=>current[key]===height?current:{...current,[key]:height})
      }
    }
    const previous=previewDocumentObserversRef.current.get(frame)
    previous?.resize?.disconnect()
    previous?.mutation?.disconnect()
    update()
    if(typeof ResizeObserver!=='undefined'){
      const resize=new ResizeObserver(update)
      if(doc.documentElement)resize.observe(doc.documentElement)
      if(doc.body)resize.observe(doc.body)
      const mutation=typeof MutationObserver!=='undefined'?new MutationObserver(update):null
      if(mutation&&doc.body)mutation.observe(doc.body,{childList:true,subtree:true,attributes:true,characterData:true})
      previewDocumentObserversRef.current.set(frame,{resize,mutation})
    }
  }
  const handlePreviewFrameLoad=event=>observePreviewDocument(event.currentTarget)
  useEffect(()=>{setPreviewDocumentHeights({floating:previewHeight,inline:previewHeight})},[previewDevice])
  useEffect(()=>()=>{previewDocumentObserversRef.current.forEach(observers=>{observers.resize?.disconnect();observers.mutation?.disconnect()});previewDocumentObserversRef.current.clear()},[])
  useLayoutEffect(()=>{
    const element=previewViewportRef.current
    if(!element)return
    const update=()=>setPreviewContainerSize({width:element.clientWidth,height:element.clientHeight})
    update()
    if(typeof ResizeObserver==='undefined'){window.addEventListener('resize',update);return()=>window.removeEventListener('resize',update)}
    const observer=new ResizeObserver(update)
    observer.observe(element)
    return()=>observer.disconnect()
  },[previewOpen])
  useLayoutEffect(()=>{
    if(!hoverPreviewMounted)return
    const element=hoverPreviewViewportRef.current
    if(!element)return
    const update=()=>setHoverPreviewSize({width:element.clientWidth,height:element.clientHeight})
    update()
    if(typeof ResizeObserver==='undefined'){window.addEventListener('resize',update);return()=>window.removeEventListener('resize',update)}
    const observer=new ResizeObserver(update)
    observer.observe(element)
    return()=>observer.disconnect()
  },[hoverPreviewMounted])
  useEffect(()=>()=>{if(hoverPreviewHideTimerRef.current)window.clearTimeout(hoverPreviewHideTimerRef.current)},[])
  useLayoutEffect(()=>{
    const element=inlinePreviewViewportRef.current
    if(!element)return
    const update=()=>setInlinePreviewSize({width:element.clientWidth,height:element.clientHeight})
    update()
    if(typeof ResizeObserver==='undefined'){window.addEventListener('resize',update);return()=>window.removeEventListener('resize',update)}
    const observer=new ResizeObserver(update)
    observer.observe(element)
    return()=>observer.disconnect()
  },[loading])
  useEffect(()=>{
    let active=true
    fetch('/api/cms/layout/',{credentials:'same-origin',headers:{Accept:'application/json'},cache:'no-store'})
      .then(async response=>{const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(response.status===403?'Sua conta não tem permissão para acessar o layout.':'Não foi possível carregar as opções de layout.');return data})
      .then(data=>{if(!active)return;const next={...DEFAULTS,...(data.settings||{})};setSettings(next);setSaved(next);setPreviewMode(next.default_gallery_view);setCanChange(Boolean(data.permissions?.canChange))})
      .catch(err=>{if(active)setError(err.message)}).finally(()=>{if(active)setLoading(false)})
    return()=>{active=false}
  },[])
  const hasChanges=JSON.stringify(settings)!==JSON.stringify(saved)
  const previewUrl='/?layout_preview=1&layout_preview_live=1'
  const hoverPreviewState=()=>{
    if(!hoveredOption)return {settings,focus:previewFocus,previewMode,animatePreview:false}
    const nextSettings={...settings,[hoveredOption.name]:hoveredOption.value}
    const nextMode=hoveredOption.name==='default_gallery_view'?hoveredOption.value:hoveredOption.name==='gallery_columns'?'grade':previewMode
    const focus=['gallery_columns','default_gallery_view'].includes(hoveredOption.name)?'gallery':['hero_alignment','hero_size'].includes(hoveredOption.name)?'hero':['show_bio','show_bio_image'].includes(hoveredOption.name)?'bio':hoveredOption.name==='show_references'?'references':'page'
    return {settings:nextSettings,focus,previewMode:nextMode,animatePreview:true}
  }
  const sendPreviewUpdate=(target,override)=>{
    const payload=override||{settings,focus:previewFocus,previewMode,animatePreview:false}
    target?.postMessage({type:'cms-layout-preview:update',...payload},window.location.origin)
  }
  const previewingPreset=LAYOUT_PRESETS.find(preset=>preset.id===previewingPresetId)||null
  const previewingPresetSettings=previewingPreset?buildPresetSettings(settings,previewingPreset):settings
  const inlinePreviewPayload=previewingPreset?{settings:previewingPresetSettings,focus:'page',previewMode:previewingPreset.settings.default_gallery_view,animatePreview:true}:{settings,focus:previewFocus,previewMode,animatePreview:false}
  const scrollToElement=(element)=>element?.scrollIntoView({behavior:'smooth',block:'start'})
  const previewLayoutPreset=preset=>{
    setPreviewingPresetId(preset.id)
    setHoveredOption(null)
    setNotice('Prévia de “'+preset.title+'”. Compare os modelos aqui embaixo e confirme quando decidir.')
    window.setTimeout(()=>scrollToElement(inlinePreviewSectionRef.current),80)
  }
  const stepPreviewPreset=direction=>{
    const currentIndex=Math.max(0,LAYOUT_PRESETS.findIndex(preset=>preset.id===previewingPresetId))
    const nextIndex=(currentIndex+direction+LAYOUT_PRESETS.length)%LAYOUT_PRESETS.length
    setPreviewingPresetId(LAYOUT_PRESETS[nextIndex].id)
  }
  const confirmPreviewPreset=()=>{
    if(!previewingPreset)return
    setSettings(previewingPresetSettings)
    setPreviewMode(previewingPreset.settings.default_gallery_view)
    setPreviewingPresetId(null)
    setNotice('Modelo “'+previewingPreset.title+'” selecionado. Agora você pode ajustar as opções abaixo; nada foi publicado ainda.')
    window.setTimeout(()=>scrollToElement(postPresetMenuRef.current),80)
  }
  const cancelPreviewPreset=()=>{
    setPreviewingPresetId(null)
    setNotice('Escolha de modelo cancelada. Suas configurações anteriores foram mantidas.')
    window.setTimeout(()=>scrollToElement(presetSectionRef.current),80)
  }
  // A prévia completa pode simular modelos sem alterar as configurações do editor.
  useEffect(()=>{
    const floatingWindow=previewIframeRef.current?.contentWindow
    const inlineWindow=inlinePreviewIframeRef.current?.contentWindow
    const handlePreviewReady=event=>{
      if(event.origin!==window.location.origin||event.data?.type!=='cms-layout-preview:ready')return
      if(event.source===inlineWindow)sendPreviewUpdate(event.source,inlinePreviewPayload)
      else if(event.source===floatingWindow)sendPreviewUpdate(event.source)
    }
    window.addEventListener('message',handlePreviewReady)
    sendPreviewUpdate(floatingWindow)
    sendPreviewUpdate(inlineWindow,inlinePreviewPayload)
    return()=>window.removeEventListener('message',handlePreviewReady)
  },[settings,previewFocus,previewMode,previewOpen,previewingPresetId])

  // A simulação de hover é isolada do preview final e atualizada no máximo uma vez por frame.
  useEffect(()=>{
    if(!hoverPreviewMounted||!hoveredOption)return
    const hoverWindow=hoverPreviewIframeRef.current?.contentWindow
    if(!hoverWindow)return
    const hoverState=hoverPreviewState()
    const handlePreviewReady=event=>{
      if(event.origin===window.location.origin&&event.data?.type==='cms-layout-preview:ready'&&event.source===hoverWindow)sendPreviewUpdate(hoverWindow,hoverState)
    }
    window.addEventListener('message',handlePreviewReady)
    const frame=window.requestAnimationFrame(()=>sendPreviewUpdate(hoverWindow,hoverState))
    return()=>{window.cancelAnimationFrame(frame);window.removeEventListener('message',handlePreviewReady)}
  },[settings,previewFocus,previewMode,hoveredOption,hoverPreviewMounted])

  const showOptionPreview=(name,value,label,detail,event)=>{
    if(hoverPreviewHideTimerRef.current)window.clearTimeout(hoverPreviewHideTimerRef.current)
    const rect=event?.currentTarget?.getBoundingClientRect?.()
    const viewportWidth=window.innerWidth
    const viewportHeight=window.innerHeight
    const margin=16
    const gap=12
    const panelWidth=Math.min(380,viewportWidth-margin*2)
    const preferredHeight=Math.min(440,viewportHeight-margin*2)
    const rightSpace=rect?viewportWidth-rect.right-gap-margin:0
    const leftSpace=rect?rect.left-gap-margin:0
    const placeRight=rightSpace>=panelWidth||rightSpace>=leftSpace
    const availableWidth=Math.max(240,Math.min(panelWidth,placeRight?rightSpace:leftSpace))
    const left=rect
      ?(placeRight?rect.right+gap:rect.left-gap-availableWidth)
      :margin
    const top=rect?Math.min(rect.bottom+gap,viewportHeight-margin-180):margin
    const maxHeight=Math.max(180,Math.min(preferredHeight,viewportHeight-top-margin))
    setHoverPreviewPosition({
      left:Math.max(margin,Math.min(left,viewportWidth-availableWidth-margin)),
      top:Math.max(margin,top),
      width:availableWidth,
      maxHeight,
    })
    setHoveredOption(current=>current?.name===name&&current?.value===value?current:{name,value,label,detail})
    setHoverPreviewMounted(true)
  }
  const hideOptionPreview=()=>{
    if(hoverPreviewHideTimerRef.current){
      window.clearTimeout(hoverPreviewHideTimerRef.current)
      hoverPreviewHideTimerRef.current=null
    }
    // A prévia é estritamente contextual: saiu do campo, desmonta o iframe
    // imediatamente para impedir mensagens/foco de uma opção anterior.
    setHoveredOption(null)
    setHoverPreviewMounted(false)
  }
  const colorKey=name=>`${editingTheme}_${name}`
  const contrastMetrics=useMemo(()=>{
    const background=settings[colorKey('color_background')],surface=settings[colorKey('color_surface')]
    const text=accessibleColor(settings[colorKey('color_text')],background)
    const surfaceText=accessibleColor(settings[colorKey('color_text')],surface)
    const muted=accessibleColor(settings[colorKey('color_muted')],background)
    const surfaceMuted=accessibleColor(settings[colorKey('color_muted')],surface)
    const accent=accessibleColor(settings[colorKey('color_accent')],background)
    return [
      ['Texto principal / fundo',contrastRatio(text,background)],
      ['Texto principal / cartões',contrastRatio(surfaceText,surface)],
      ['Texto secundário / fundo',contrastRatio(muted,background)],
      ['Texto secundário / cartões',contrastRatio(surfaceMuted,surface)],
      ['Destaques / fundo',contrastRatio(accent,background)],
    ]
  },[settings,editingTheme])
  const contrast=Math.min(...contrastMetrics.map(([,ratio])=>ratio))
  const updateCustomSection=(id,patch)=>setSettings(current=>({...current,custom_sections:(current.custom_sections||[]).map(section=>section.id===id?{...section,...patch}:section)}))
  const addCustomSection=template=>{
    const id=template.type+'-'+Date.now().toString(36)
    setSettings(current=>({...current,custom_sections:[...(current.custom_sections||[]),{id,type:template.type,title:template.title,intro:template.intro,items:[]}]}))
    setNotice('Seção adicionada. Abra “Editar conteúdo” para preencher os detalhes.')
  }
  const moveCustomSection=(id,delta)=>setSettings(current=>{const sections=[...(current.custom_sections||[])];const index=sections.findIndex(section=>section.id===id);const target=index+delta;if(index<0||target<0||target>=sections.length)return current;[sections[index],sections[target]]=[sections[target],sections[index]];return {...current,custom_sections:sections}})
  const removeCustomSection=id=>setSettings(current=>({...current,custom_sections:(current.custom_sections||[]).filter(section=>section.id!==id)}))
  const addCustomSectionItem=id=>updateCustomSection(id,{items:[...(settings.custom_sections||[]).find(section=>section.id===id)?.items||[],{title:'Novo item',description:'',url:'',image:'',period:''}]})
  const updateCustomSectionItem=(sectionId,index,patch)=>setSettings(current=>({...current,custom_sections:(current.custom_sections||[]).map(section=>section.id===sectionId?{...section,items:section.items.map((item,itemIndex)=>itemIndex===index?{...item,...patch}:item)}:section)}))
  const removeCustomSectionItem=(sectionId,index)=>setSettings(current=>({...current,custom_sections:(current.custom_sections||[]).map(section=>section.id===sectionId?{...section,items:section.items.filter((_,itemIndex)=>itemIndex!==index)}:section)}))
  const applyLayoutPreset=preset=>{setSettings(current=>buildPresetSettings(current,preset));setPreviewMode(preset.settings.default_gallery_view);setPreviewingPresetId(null);setError('');setNotice('Modelo “'+preset.title+'” selecionado. Ajuste as opções e salve quando estiver pronto.')}
  const change=(name,value)=>{const key=COLOR_FIELDS.some(([field])=>field===name)?colorKey(name):name;setSettings(current=>({...current,[key]:value}));setHoveredOption(null);if(hoverPreviewHideTimerRef.current)window.clearTimeout(hoverPreviewHideTimerRef.current);if(name==='default_gallery_view')setPreviewMode(value);else if(name==='gallery_columns')setPreviewMode('grade');setPreviewFocus(['gallery_columns','default_gallery_view'].includes(name)?'gallery':['hero_alignment','hero_size'].includes(name)?'hero':['show_bio','show_bio_image'].includes(name)?'bio':name==='show_references'?'references':'page');setError('');setNotice('')}
  const paletteIsActive=palette=>{
    const keys=['color_background','color_surface','color_text','color_muted','color_accent']
    return palette.darkColors.every((value,index)=>settings[`dark_${keys[index]}`]===value)
      && palette.lightColors.every((value,index)=>settings[`light_${keys[index]}`]===value)
  }
  const applyPalette=palette=>{
    const [darkBackground,darkSurface,darkText,darkMuted,darkAccent]=palette.darkColors
    const [lightBackground,lightSurface,lightText,lightMuted,lightAccent]=palette.lightColors
    setSettings(current=>({...current,dark_color_background:darkBackground,dark_color_surface:darkSurface,dark_color_text:darkText,dark_color_muted:darkMuted,dark_color_accent:darkAccent,light_color_background:lightBackground,light_color_surface:lightSurface,light_color_text:lightText,light_color_muted:lightMuted,light_color_accent:lightAccent}));setPreviewFocus('page')
    setError('');setNotice('')
  }
  const save=async event=>{
    event.preventDefault();setSaving(true);setError('');setNotice('')
    try{
      const response=await fetch('/api/cms/layout/',{method:'PATCH',credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json','Content-Type':'application/json','X-CSRFToken':readCookie('csrftoken')},body:JSON.stringify(settings)})
      const data=await response.json().catch(()=>({}))
      if(!response.ok)throw new Error(data.error==='layout_edit_permission_required'?'Sua conta não tem permissão para alterar o layout.':'Não foi possível salvar. Tente novamente.')
      const next={...DEFAULTS,...data.settings};setSettings(next);setSaved(next);setNotice('Personalização salva. As configurações foram aplicadas ao portfólio.')
    }catch(err){setError(err.message||'Não foi possível salvar.')}finally{setSaving(false)}
  }
  const discard=()=>{setSettings(saved);setPreviewMode(saved.default_gallery_view);setError('');setNotice('Alterações descartadas.')}
  const reset=()=>{setSettings(DEFAULTS);setPreviewMode(DEFAULTS.default_gallery_view);setError('');setNotice('')}
  if(loading)return <div className="cms-loading">Carregando opções de layout…</div>
  return <section className="cms-layout-page">
    <header className="cms-library-heading"><div><p className="cms-eyebrow">APARÊNCIA DO PORTFÓLIO</p><h1>Layout<span>.</span></h1><p>Personalize a composição e as cores vendo o resultado antes de salvar.</p></div>
      <div className="cms-layout-heading-actions"><button type="button" className="cms-secondary-link cms-layout-preview-toggle" onClick={()=>setPreviewOpen(value=>!value)}>{previewOpen?'Ocultar janela flutuante':'◉ Abrir janela flutuante'}</button><a className="cms-secondary-link" href="/" target="_blank" rel="noreferrer">Site publicado ↗</a></div>
    </header>
    <div className="cms-layout-intro"><span className="cms-layout-intro-mark" aria-hidden="true">✳</span><div><strong>Experimente sem medo</strong><p>As mudanças aparecem na prévia e ficam apenas neste editor até você salvar. Testar combinações não altera o site publicado.</p></div></div>
    <div className={"cms-layout-workspace"+(hoverPreviewMounted&&hoveredOption?" has-hover-preview":"")}>
      <form className="cms-layout-form" onSubmit={save}>
        <div className="cms-save-state" role="status" aria-live="polite"><span className="cms-save-state-dot"/>{hasChanges?'Alterações ainda não salvas':'Tudo salvo'}</div>
        <section className="cms-layout-presets" ref={presetSectionRef}>
          <div className="cms-layout-section-heading"><div><p className="cms-eyebrow">PONTO DE PARTIDA</p><h2>Modelos de portfólio</h2></div><span className="cms-layout-preset-count">7 modelos · 4 apresentações</span></div>
          <p className="cms-layout-help">Os modelos mudam a forma de explorar as obras e o comportamento do menu — não apenas as seções. Depois, ajuste apresentação, cores e conteúdo. Nada é publicado até salvar.</p>
          <div className="cms-layout-preset-grid">
            {LAYOUT_PRESETS.map(preset=><article className="cms-layout-preset-card" key={preset.id}>
              <div className={'cms-layout-preset-art preset-'+preset.id+' mode-'+preset.settings.presentation_mode+' nav-'+preset.settings.navigation_mode} aria-hidden="true">
                <div className="cms-layout-preset-mock-nav"><i/><i/><i/><i/></div>
                <div className="cms-layout-preset-mock-hero"><small>{preset.kind.split('·')[0].trim()}</small><b>{preset.title}</b><i/></div>
                <div className="cms-layout-preset-mock-content"><div className="cms-layout-preset-mock-image"/><div className="cms-layout-preset-mock-copy"><i/><i/><i/></div><div className="cms-layout-preset-mock-sections">{preset.sections.slice(0,4).map(type=><i key={type}>{SECTION_TEMPLATES.find(item=>item.type===type)?.label}</i>)}</div></div>
              </div>
              <div className="cms-layout-preset-copy"><small>{preset.kind}</small><strong>{preset.title}</strong><p>{preset.description}</p><div className="cms-layout-preset-tags"><span>{({editorial:'Editorial',carousel:'Carrossel',immersive:'Imersivo',masonry:'Mosaico'})[preset.settings.presentation_mode]}</span><span>{({curtain:'Cortina',dropdown:'Dropdown',sidebar:'Lateral'})[preset.settings.navigation_mode]}</span></div></div>
              <button type="button" className="cms-layout-preset-apply" onClick={()=>previewLayoutPreset(preset)} disabled={!canChange||saving}>Visualizar modelo <span>→</span></button>
            </article>)}
          </div>
        </section>
        <section className="cms-layout-section-library" ref={postPresetMenuRef}>
          <div className="cms-layout-section-heading"><div><p className="cms-eyebrow">CONTEÚDO MODULAR</p><h2>Biblioteca de seções</h2></div><span className="cms-layout-preset-count">{(settings.custom_sections||[]).length} adicionadas</span></div>
          <p className="cms-layout-help">Adicione apenas o que faz sentido para seu trabalho. Cada seção pode ser editada e organizada; deixe sem itens para mantê-la como rascunho no editor.</p>
          <div className="cms-layout-section-template-grid">
            {SECTION_TEMPLATES.map(template=><button type="button" key={template.type} onClick={()=>addCustomSection(template)} disabled={!canChange||saving||(settings.custom_sections||[]).length>=10}>
              <strong>{template.label}</strong><small>{template.intro}</small><span>+ Adicionar seção</span>
            </button>)}
          </div>
          {(settings.custom_sections||[]).map((section,index)=><article className="cms-layout-custom-section" key={section.id}>
            <header><div><small>SEÇÃO {String(index+1).padStart(2,'0')}</small><strong>{section.title}</strong></div><div className="cms-layout-custom-section-actions"><button type="button" className="cms-editor-cancel" onClick={()=>moveCustomSection(section.id,-1)} disabled={!canChange||saving||index===0} aria-label="Mover seção para cima">↑</button><button type="button" className="cms-editor-cancel" onClick={()=>moveCustomSection(section.id,1)} disabled={!canChange||saving||index===(settings.custom_sections||[]).length-1} aria-label="Mover seção para baixo">↓</button><button type="button" className="cms-editor-cancel" onClick={()=>removeCustomSection(section.id)} disabled={!canChange||saving}>Remover</button></div></header>
            <details className="cms-layout-custom-section-editor">
              <summary><span>Editar conteúdo</span><small>{(section.items||[]).length} itens cadastrados</small></summary>
              <div className="cms-layout-custom-section-fields">
            <label>Título da seção<input required value={section.title} maxLength={100} onChange={event=>updateCustomSection(section.id,{title:event.target.value})} disabled={!canChange||saving}/></label>
            <label>Texto de apresentação<textarea rows="2" maxLength={500} value={section.intro||''} onChange={event=>updateCustomSection(section.id,{intro:event.target.value})} disabled={!canChange||saving}/></label>
            <div className="cms-layout-custom-items">
              {(section.items||[]).map((item,itemIndex)=><div className="cms-layout-custom-item" key={itemIndex}>
                <div className="cms-layout-custom-item-heading"><strong>Item {itemIndex+1}</strong><button type="button" onClick={()=>removeCustomSectionItem(section.id,itemIndex)} disabled={!canChange||saving}>Excluir item</button></div>
                <label>Nome<input required value={item.title||''} maxLength={120} onChange={event=>updateCustomSectionItem(section.id,itemIndex,{title:event.target.value})} disabled={!canChange||saving}/></label>
                <label>Descrição<textarea rows="2" maxLength={1200} value={item.description||''} onChange={event=>updateCustomSectionItem(section.id,itemIndex,{description:event.target.value})} disabled={!canChange||saving}/></label>
                <div className="cms-layout-custom-item-fields">
                  <label>Período<input value={item.period||''} maxLength={100} onChange={event=>updateCustomSectionItem(section.id,itemIndex,{period:event.target.value})} disabled={!canChange||saving} placeholder="Ex.: 2025 · Porto Alegre"/></label>
                  <label>Link externo<input type="url" value={item.url||''} maxLength={500} onChange={event=>updateCustomSectionItem(section.id,itemIndex,{url:event.target.value})} disabled={!canChange||saving} placeholder="https://…"/></label>
                  <label>Imagem (URL)<input type="url" value={item.image||''} maxLength={500} onChange={event=>updateCustomSectionItem(section.id,itemIndex,{image:event.target.value})} disabled={!canChange||saving} placeholder="https://…"/></label>
                </div>
              </div>)}
            </div>
            <button type="button" className="cms-layout-add-item" onClick={()=>addCustomSectionItem(section.id)} disabled={!canChange||saving||(section.items||[]).length>=20}>+ Adicionar conteúdo</button>
              </div>
            </details>
          </article>)}
        </section>
        <section className="cms-layout-color-panel">
          <div className="cms-layout-section-heading"><div><p className="cms-eyebrow">IDENTIDADE VISUAL</p><h2>Cores do portfólio</h2></div><span className="cms-layout-color-chip" style={{background:settings[colorKey('color_accent')]}}/></div>
          <p className="cms-layout-help">Cada tema tem sua própria identidade. Alterar o claro não modifica o escuro, e vice-versa.</p>
          <div className="cms-layout-theme-tabs" role="group" aria-label="Tema que está sendo editado"><button type="button" className={editingTheme==='dark'?'active':''} aria-pressed={editingTheme==='dark'} onClick={()=>setEditingTheme('dark')}>Tema escuro</button><button type="button" className={editingTheme==='light'?'active':''} aria-pressed={editingTheme==='light'} onClick={()=>setEditingTheme('light')}>Tema claro</button></div>
          <p className="cms-layout-active-theme">Editando as cores do tema {editingTheme==='dark'?'escuro':'claro'}.</p>
          <div className="cms-layout-palettes">{PALETTES.map(palette=><button type="button" className={'cms-layout-palette'+(paletteIsActive(palette)?' selected':'')} key={palette.name} onClick={()=>applyPalette(palette)} aria-pressed={paletteIsActive(palette)} aria-label={'Aplicar paleta '+palette.name}><span className="cms-layout-palette-swatches">{(editingTheme==='dark'?palette.darkColors:palette.lightColors).map(color=><i key={color} style={{background:color}}/>)}</span><strong>{palette.name}</strong></button>)}</div>
          <div className="cms-layout-colors">{COLOR_FIELDS.map(([name,label,detail])=><label className="cms-layout-color-field" key={name}><span><strong>{label}</strong><small>{detail}</small></span><span className="cms-layout-color-input"><input type="color" value={settings[colorKey(name)]} onChange={event=>change(name,event.target.value)} disabled={!canChange||saving} aria-label={label+' — tema '+(editingTheme==='dark'?'escuro':'claro')}/><code>{settings[colorKey(name)].toUpperCase()}</code></span></label>)}</div>
          <div className={'cms-layout-contrast '+(contrast>=4.5?'good':'warning')} role="status"><span>{contrast>=4.5?'✓':'!'}</span><div><strong>{contrast>=4.5?'Contraste automático ativo':'Verifique a combinação de cores'}</strong><small>{'Menor contraste após o ajuste automático: '+contrast.toFixed(2)+':1. Texto principal, secundário e destaques são corrigidos separadamente para cada superfície.'}</small></div></div>
        </section>
        <div className="cms-layout-fields">{FIELD_GROUPS.map(group=><section className="cms-layout-field-group" key={group.id}><header className="cms-layout-group-heading"><div><p className="cms-eyebrow">PERSONALIZAÇÃO</p><h2>{group.title}</h2><p>{group.description}</p></div></header><div className="cms-layout-group-fields">{FIELDS.filter(field=>field.group===group.id).map(field=><fieldset className="cms-layout-field" key={field.name} disabled={!canChange||saving}><legend>{field.title}</legend><p>{field.description}</p><div className="cms-layout-options">{field.options.map(([value,label,detail])=><label className={'cms-layout-option'+(settings[field.name]===value?' selected':'')} key={value} onMouseEnter={event=>showOptionPreview(field.name,value,label,detail,event)} onMouseLeave={hideOptionPreview} onFocus={event=>showOptionPreview(field.name,value,label,detail,event)} onBlur={hideOptionPreview} onClick={hideOptionPreview}><input type="radio" name={field.name} value={value} checked={settings[field.name]===value} onChange={()=>change(field.name,value)}/><span className="cms-layout-option-copy"><strong>{label}</strong><small>{detail}</small></span><span className="cms-layout-option-check" aria-hidden="true">✓</span></label>)}</div></fieldset>)}</div></section>)}
        </div>
        {error&&<div className="cms-editor-message error" role="alert">{error}</div>}{notice&&<div className="cms-editor-message success" role="status">{notice}</div>}
        <div className="cms-editor-actions"><span>{canChange?'Salvar aplica as escolhas ao portfólio público.':'Você tem acesso de leitura às opções de layout.'}</span><div className="cms-editor-save-actions"><button className="cms-editor-cancel" type="button" onClick={discard} disabled={!hasChanges||saving}>Descartar</button><button className="cms-editor-cancel" type="button" onClick={reset} disabled={!canChange||saving||!hasChanges}>Restaurar padrão</button><button className="cms-primary-button" type="submit" disabled={!canChange||saving||!hasChanges}>{saving?'Salvando…':'Salvar personalização'} <span>↗</span></button></div></div>
      </form>
      {hoverPreviewMounted&&hoveredOption&&createPortal(
        <aside className="cms-layout-hover-preview cms-layout-hover-preview-floating" aria-label="Prévia temporária da opção" style={{position:'fixed',left:hoverPreviewPosition.left,top:hoverPreviewPosition.top,width:hoverPreviewPosition.width||'min(380px, calc(100vw - 32px))',maxWidth:'calc(100vw - 32px)',boxSizing:'border-box',zIndex:1000,maxHeight:hoverPreviewPosition.maxHeight||'calc(100vh - 32px)'}}>
          <header className="cms-layout-hover-preview-heading">
            <div><p className="cms-eyebrow">ANTES DE APLICAR</p><strong>{hoveredOption.label}</strong><small>{hoveredOption.detail}</small></div>
          </header>
          <div className="cms-layout-preview-frame cms-layout-hover-preview-frame cms-layout-preview-frame-scaled" ref={hoverPreviewViewportRef} data-device={previewDevice}>
            <div className="cms-layout-preview-stage cms-layout-preview-stage-scaled" style={{width:hoverPreviewStageWidth,height:hoverPreviewStageHeight}}>
              <iframe ref={hoverPreviewIframeRef} title="Prévia temporária do portfólio" src="/?layout_preview=1" loading="eager" scrolling="yes" style={{width:previewWidth,height:previewHeight,transform:`scale(${hoverPreviewScale})`,transformOrigin:'top left'}}/>
            </div>
          </div>
          <p className="cms-layout-preview-caption">Simulação temporária. Clique na opção para aplicá-la ao editor.</p>
        </aside>,
        document.body
      )}
      {previewOpen&&<aside className={'cms-layout-preview-panel floating'+(previewMaximized?' maximized':'')} aria-label="Janela flutuante de prévia" style={previewMaximized?undefined:{left:previewPosition.x,top:previewPosition.y,width:previewSize.width,height:previewSize.height}}><div className="cms-layout-preview-heading" onPointerDown={startPreviewDrag} onPointerMove={movePreviewDrag} onPointerUp={stopPreviewDrag} onPointerCancel={stopPreviewDrag}><div><p className="cms-eyebrow">PRÉVIA AO VIVO</p><strong>Seu portfólio</strong><small className="cms-layout-preview-drag-hint">Arraste para mover</small></div><div className="cms-layout-preview-window-actions"><span>Não publicado</span><button className="cms-preview-window-button" type="button" aria-label={previewMaximized?'Restaurar janela':'Maximizar janela'} title={previewMaximized?'Restaurar':'Maximizar'} onClick={()=>setPreviewMaximized(value=>!value)}><svg viewBox="0 0 20 20" aria-hidden="true">{previewMaximized?<path d="M7 3v2H5v10h10v-2h2v4H3V3h4zm3 0h7v7h-2V6.4l-6.3 6.3-1.4-1.4L13.6 5H10V3z"/>:<path d="M3 3h14v14H3V3zm2 2v10h10V5H5z"/>}</svg></button><button className="cms-preview-window-button close" type="button" aria-label="Fechar janela flutuante" title="Fechar" onClick={()=>setPreviewOpen(false)}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15"/></svg></button></div></div><div className="cms-layout-preview-devices" role="group" aria-label="Tamanho da prévia">{Object.entries(PREVIEW_DEVICES).map(([key,device])=><button key={key} type="button" className={previewDevice===key?'active':''} aria-pressed={previewDevice===key} onClick={()=>setPreviewDevice(key)}>{device.label}</button>)}</div><div className="cms-layout-preview-frame cms-layout-preview-frame-scaled" ref={previewViewportRef} data-device={previewDevice} data-preview-scale={previewScale.toFixed(3)}><div className="cms-layout-preview-stage cms-layout-preview-stage-scaled" style={{width:previewStageWidth,height:previewStageHeight}}><iframe ref={previewIframeRef} title={`Prévia flutuante em ${PREVIEW_DEVICES[previewDevice].label}`} src={previewUrl} onLoad={handlePreviewFrameLoad} loading="eager" scrolling="no" style={{width:previewWidth,height:previewDocumentHeight,transform:`scale(${previewScale})`,transformOrigin:'top left'}}/></div></div><p className="cms-layout-preview-caption">A página é reduzida para caber inteira na largura do modal. Role verticalmente para percorrer o conteúdo; nada será publicado até salvar.</p>{!previewMaximized&&<button className="cms-preview-resize-handle" type="button" aria-label="Redimensionar janela de prévia" title="Arraste para redimensionar" onPointerDown={startPreviewResize} onPointerMove={movePreviewResize} onPointerUp={stopPreviewResize} onPointerCancel={stopPreviewResize}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 15 15 5M10 15l5-5"/></svg></button>}</aside>}
    </div>
    <section className={'cms-layout-inline-preview'+(previewingPreset?' is-preset-preview':'')} ref={inlinePreviewSectionRef} aria-label="Prévia completa do portfólio">
      <div className="cms-layout-preview-heading"><div><p className="cms-eyebrow">{previewingPreset?'EXPERIMENTANDO UM MODELO':'VISUALIZAÇÃO COMPLETA'}</p><strong>{previewingPreset?previewingPreset.title:'Portfólio em tamanho real'}</strong></div><span>Prévia privada</span></div>
      {previewingPreset&&<div className="cms-layout-preset-preview-controls" aria-label="Navegar pelos modelos de portfólio">
        <div className="cms-layout-preset-preview-nav"><button type="button" onClick={()=>stepPreviewPreset(-1)} aria-label="Modelo anterior">←</button><span>{LAYOUT_PRESETS.findIndex(preset=>preset.id===previewingPreset.id)+1} de {LAYOUT_PRESETS.length}</span><button type="button" onClick={()=>stepPreviewPreset(1)} aria-label="Próximo modelo">→</button></div>
        <div className="cms-layout-preset-preview-actions"><button type="button" className="cms-editor-cancel" onClick={cancelPreviewPreset}>Voltar sem escolher</button><button type="button" className="cms-primary-button" onClick={confirmPreviewPreset}>Confirmar este layout <span>✓</span></button></div>
      </div>}
      <div className="cms-layout-preview-devices" role="group" aria-label="Dispositivo da prévia completa">{Object.entries(PREVIEW_DEVICES).map(([key,device])=><button key={key} type="button" className={previewDevice===key?'active':''} aria-pressed={previewDevice===key} onClick={()=>setPreviewDevice(key)}>{device.label}</button>)}</div>
      <div className="cms-layout-preview-frame cms-layout-preview-frame-inline cms-layout-preview-frame-scaled" ref={inlinePreviewViewportRef} data-device={previewDevice} data-preview-scale={inlinePreviewScale.toFixed(3)}><div className="cms-layout-preview-stage cms-layout-preview-stage-inline cms-layout-preview-stage-scaled" style={{width:inlinePreviewStageWidth,height:inlinePreviewStageHeight}}><iframe ref={inlinePreviewIframeRef} title={`Prévia completa do portfólio em ${PREVIEW_DEVICES[previewDevice].label}`} src={previewUrl} onLoad={handlePreviewFrameLoad} loading="lazy" scrolling="no" style={{width:previewWidth,height:inlinePreviewDocumentHeight,transform:`scale(${inlinePreviewScale})`,transformOrigin:'top left'}}/></div></div>
      <p className="cms-layout-preview-caption">Largura ajustada automaticamente ({Math.round(inlinePreviewScale*100)}%). Role para cima e para baixo para percorrer todo o portfólio.</p>
    </section>
    
  </section>
}
