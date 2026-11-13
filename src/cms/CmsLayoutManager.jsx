import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './CmsLayoutManager.css'

const DEFAULTS = {
  content_width:'standard', hero_alignment:'center', hero_size:'large',
  section_spacing:'comfortable', gallery_columns:'3', default_gallery_view:'lista', default_theme:'escuro',
  dark_color_background:'#061522', dark_color_surface:'#0b2943', dark_color_text:'#eff7ff', dark_color_muted:'#a9bdcc', dark_color_accent:'#93c8f2',
  light_color_background:'#f5f2eb', light_color_surface:'#ffffff', light_color_text:'#24231f', light_color_muted:'#77746c', light_color_accent:'#657c62',
  show_bio_image:true, show_bio:true, show_references:true,
}
const FIELDS = [
  {group:'composition',name:'content_width',title:'Largura do conteúdo',description:'Define quanto espaço o conteúdo ocupa em telas maiores.',options:[['compact','Enxuto','Mais foco e respiro lateral'],['standard','Equilibrado','Proporção atual'],['wide','Amplo','Mais espaço para imagens']]},
  {group:'composition',name:'hero_alignment',title:'Alinhamento da apresentação',description:'Escolha como o nome e a frase aparecem no topo.',options:[['center','Centralizado','Composição simétrica'],['left','À esquerda','Composição editorial']]},
  {group:'composition',name:'hero_size',title:'Altura da apresentação',description:'Controla o espaço reservado ao cabeçalho inicial.',options:[['compact','Compacta','Chega mais rápido ao conteúdo'],['large','Expandida','Dá destaque à identidade']]},
  {group:'composition',name:'section_spacing',title:'Espaçamento entre seções',description:'Ajusta o ritmo vertical entre as partes do portfólio.',options:[['compact','Compacto','Mais conteúdo na tela'],['comfortable','Confortável','Equilíbrio e respiro'],['spacious','Generoso','Mais espaço entre projetos']]},
  {group:'composition',name:'gallery_columns',title:'Colunas da grade',description:'Número de colunas em telas grandes. Em celulares, a grade continua adaptável.',options:[['2','2 colunas','Imagens maiores'],['3','3 colunas','Equilíbrio'],['4','4 colunas','Visão panorâmica']]},
  {group:'composition',name:'default_gallery_view',title:'Visualização inicial',description:'Como o visitante encontra as obras ao abrir o portfólio.',options:[['lista','Lista editorial','Mais espaço para contexto'],['grade','Grade visual','Acervo em composição única']]},
  {group:'experience',name:'default_theme',title:'Tema inicial',description:'O visitante ainda poderá alternar entre claro e escuro.',options:[['escuro','Escuro','Apresentação imersiva'],['claro','Claro','Apresentação luminosa']]},
  {group:'content',name:'show_bio_image',title:'Imagem da apresentação',description:'Escolha se a foto ou imagem da artista aparece na seção de apresentação.',options:[[true,'Mostrar imagem','Exibe a imagem junto à apresentação'],[false,'Ocultar imagem','Mantém o texto sem a imagem']]},
  {group:'content',name:'show_bio',title:'Texto da biografia',description:'A imagem e o texto podem ser exibidos de forma independente.',options:[[true,'Mostrar biografia','Exibe o texto biográfico'],[false,'Ocultar biografia','Remove o texto da seção']]},
  {group:'content',name:'show_references',title:'Seção de referências',description:'Controla também a entrada Referências na navegação do portfólio.',options:[[true,'Mostrar referências','Exibe a seção e seus links'],[false,'Ocultar referências','Remove a seção e a entrada do menu']]},
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
  const [previewDocumentHeight,setPreviewDocumentHeight]=useState(PREVIEW_DEVICES.desktop.height)
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
  const inlinePreviewScale=inlinePreviewSize.width>0?Math.min(1,inlinePreviewSize.width/previewWidth):1
  const inlinePreviewStageWidth=previewWidth*inlinePreviewScale
  const inlinePreviewStageHeight=previewDocumentHeight*inlinePreviewScale
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
      if(height>0)setPreviewDocumentHeight(current=>current===height?current:height)
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
  },[])
  useEffect(()=>{
    let active=true
    fetch('/api/cms/layout/',{credentials:'same-origin',headers:{Accept:'application/json'},cache:'no-store'})
      .then(async response=>{const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(response.status===403?'Sua conta não tem permissão para acessar o layout.':'Não foi possível carregar as opções de layout.');return data})
      .then(data=>{if(!active)return;const next={...DEFAULTS,...(data.settings||{})};setSettings(next);setSaved(next);setPreviewMode(next.default_gallery_view);setCanChange(Boolean(data.permissions?.canChange))})
      .catch(err=>{if(active)setError(err.message)}).finally(()=>{if(active)setLoading(false)})
    return()=>{active=false}
  },[])
  const hasChanges=JSON.stringify(settings)!==JSON.stringify(saved)
  const previewUrl='/?layout_preview=1'
  const hoverPreviewState=()=>{
    if(!hoveredOption)return {settings,focus:previewFocus,previewMode}
    const nextSettings={...settings,[hoveredOption.name]:hoveredOption.value}
    const nextMode=hoveredOption.name==='default_gallery_view'?hoveredOption.value:hoveredOption.name==='gallery_columns'?'grade':previewMode
    const focus=['gallery_columns','default_gallery_view'].includes(hoveredOption.name)?'gallery':['hero_alignment','hero_size'].includes(hoveredOption.name)?'hero':['show_bio','show_bio_image'].includes(hoveredOption.name)?'bio':hoveredOption.name==='show_references'?'references':'page'
    return {settings:nextSettings,focus,previewMode:nextMode}
  }
  const sendPreviewUpdate=(target,override)=>{
    const payload=override||{settings,focus:previewFocus,previewMode}
    target?.postMessage({type:'cms-layout-preview:update',...payload},window.location.origin)
  }
  // A prévia final recebe somente as escolhas aplicadas no editor.
  useEffect(()=>{
    const allowedSources=[previewIframeRef.current?.contentWindow,inlinePreviewIframeRef.current?.contentWindow].filter(Boolean)
    const handlePreviewReady=event=>{
      if(event.origin!==window.location.origin||event.data?.type!=='cms-layout-preview:ready'||!allowedSources.includes(event.source))return
      sendPreviewUpdate(event.source)
    }
    window.addEventListener('message',handlePreviewReady)
    sendPreviewUpdate(previewIframeRef.current?.contentWindow)
    sendPreviewUpdate(inlinePreviewIframeRef.current?.contentWindow)
    return()=>window.removeEventListener('message',handlePreviewReady)
  },[settings,previewFocus,previewMode,previewOpen])

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
    const anchor=event?.currentTarget?.getBoundingClientRect?.()
    if(anchor){
      const panelWidth=Math.min(380,window.innerWidth-32)
      const panelHeight=Math.min(440,window.innerHeight-32)
      let left=anchor.right+12
      if(left+panelWidth>window.innerWidth-16)left=anchor.left-panelWidth-12
      left=Math.max(16,Math.min(left,window.innerWidth-panelWidth-16))
      const top=Math.max(16,Math.min(anchor.top,window.innerHeight-panelHeight-16))
      setHoverPreviewPosition({left,top})
    }
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
    <div className="cms-layout-workspace">
      <form className="cms-layout-form" onSubmit={save}>
        <div className="cms-save-state" role="status" aria-live="polite"><span className="cms-save-state-dot"/>{hasChanges?'Alterações ainda não salvas':'Tudo salvo'}</div>
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
        <aside className="cms-layout-hover-preview cms-layout-hover-preview-floating" aria-label="Prévia temporária da opção" style={{left:hoverPreviewPosition.left,top:hoverPreviewPosition.top}}>
          <header className="cms-layout-hover-preview-heading">
            <div><p className="cms-eyebrow">ANTES DE APLICAR</p><strong>{hoveredOption.label}</strong><small>{hoveredOption.detail}</small></div>
            <button type="button" aria-label="Fechar prévia temporária" onClick={hideOptionPreview}>×</button>
          </header>
          <div className="cms-layout-preview-frame cms-layout-hover-preview-frame cms-layout-preview-frame-scaled" ref={hoverPreviewViewportRef} data-device={previewDevice}>
            <div className="cms-layout-preview-stage cms-layout-preview-stage-scaled" style={{width:hoverPreviewStageWidth,height:hoverPreviewStageHeight}}>
              <iframe ref={hoverPreviewIframeRef} title="Prévia temporária do portfólio" src={previewUrl} loading="eager" scrolling="yes" style={{width:previewWidth,height:previewHeight,transform:`scale(${hoverPreviewScale})`,transformOrigin:'top left'}}/>
            </div>
          </div>
          <p className="cms-layout-preview-caption">Simulação temporária. Clique na opção para aplicá-la ao editor.</p>
        </aside>,
        document.body
      )}
      {previewOpen&&<aside className={'cms-layout-preview-panel floating'+(previewMaximized?' maximized':'')} aria-label="Janela flutuante de prévia" style={previewMaximized?undefined:{left:previewPosition.x,top:previewPosition.y,width:previewSize.width,height:previewSize.height}}><div className="cms-layout-preview-heading" onPointerDown={startPreviewDrag} onPointerMove={movePreviewDrag} onPointerUp={stopPreviewDrag} onPointerCancel={stopPreviewDrag}><div><p className="cms-eyebrow">PRÉVIA AO VIVO</p><strong>Seu portfólio</strong><small className="cms-layout-preview-drag-hint">Arraste para mover</small></div><div className="cms-layout-preview-window-actions"><span>Não publicado</span><button className="cms-preview-window-button" type="button" aria-label={previewMaximized?'Restaurar janela':'Maximizar janela'} title={previewMaximized?'Restaurar':'Maximizar'} onClick={()=>setPreviewMaximized(value=>!value)}><svg viewBox="0 0 20 20" aria-hidden="true">{previewMaximized?<path d="M7 3v2H5v10h10v-2h2v4H3V3h4zm3 0h7v7h-2V6.4l-6.3 6.3-1.4-1.4L13.6 5H10V3z"/>:<path d="M3 3h14v14H3V3zm2 2v10h10V5H5z"/>}</svg></button><button className="cms-preview-window-button close" type="button" aria-label="Fechar janela flutuante" title="Fechar" onClick={()=>setPreviewOpen(false)}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15"/></svg></button></div></div><div className="cms-layout-preview-devices" role="group" aria-label="Tamanho da prévia">{Object.entries(PREVIEW_DEVICES).map(([key,device])=><button key={key} type="button" className={previewDevice===key?'active':''} aria-pressed={previewDevice===key} onClick={()=>setPreviewDevice(key)}>{device.label}</button>)}</div><div className="cms-layout-preview-frame cms-layout-preview-frame-scaled" ref={previewViewportRef} data-device={previewDevice} data-preview-scale={previewScale.toFixed(3)}><div className="cms-layout-preview-stage cms-layout-preview-stage-scaled" style={{width:previewStageWidth,height:previewStageHeight}}><iframe ref={previewIframeRef} title={`Prévia flutuante em ${PREVIEW_DEVICES[previewDevice].label}`} src={previewUrl} onLoad={handlePreviewFrameLoad} loading="eager" scrolling="no" style={{width:previewWidth,height:previewDocumentHeight,transform:`scale(${previewScale})`,transformOrigin:'top left'}}/></div></div><p className="cms-layout-preview-caption">A página é reduzida para caber inteira na largura do modal. Role verticalmente para percorrer o conteúdo; nada será publicado até salvar.</p>{!previewMaximized&&<button className="cms-preview-resize-handle" type="button" aria-label="Redimensionar janela de prévia" title="Arraste para redimensionar" onPointerDown={startPreviewResize} onPointerMove={movePreviewResize} onPointerUp={stopPreviewResize} onPointerCancel={stopPreviewResize}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 15 15 5M10 15l5-5"/></svg></button>}</aside>}
    </div>
    <section className="cms-layout-inline-preview" aria-label="Prévia completa do portfólio">
      <div className="cms-layout-preview-heading"><div><p className="cms-eyebrow">VISUALIZAÇÃO COMPLETA</p><strong>Portfólio em tamanho real</strong></div><span>Prévia privada</span></div>
      <div className="cms-layout-preview-devices" role="group" aria-label="Dispositivo da prévia completa">{Object.entries(PREVIEW_DEVICES).map(([key,device])=><button key={key} type="button" className={previewDevice===key?'active':''} aria-pressed={previewDevice===key} onClick={()=>setPreviewDevice(key)}>{device.label}</button>)}</div>
      <div className="cms-layout-preview-frame cms-layout-preview-frame-inline cms-layout-preview-frame-scaled" ref={inlinePreviewViewportRef} data-device={previewDevice} data-preview-scale={inlinePreviewScale.toFixed(3)}><div className="cms-layout-preview-stage cms-layout-preview-stage-inline cms-layout-preview-stage-scaled" style={{width:inlinePreviewStageWidth,height:inlinePreviewStageHeight}}><iframe ref={inlinePreviewIframeRef} title={`Prévia completa do portfólio em ${PREVIEW_DEVICES[previewDevice].label}`} src={previewUrl} onLoad={handlePreviewFrameLoad} loading="lazy" scrolling="no" style={{width:previewWidth,height:previewDocumentHeight,transform:`scale(${inlinePreviewScale})`,transformOrigin:'top left'}}/></div></div>
      <p className="cms-layout-preview-caption">Escala pela largura: {Math.round(inlinePreviewScale*100)}% · viewport lógico de {previewWidth} × {previewHeight}px. A página cabe inteira na horizontal; use a rolagem vertical para percorrer o conteúdo.</p>
    </section>
    
  </section>
}
