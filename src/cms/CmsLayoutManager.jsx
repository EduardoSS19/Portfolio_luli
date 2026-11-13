import { useEffect, useMemo, useState } from 'react'
import './CmsLayoutManager.css'

const DEFAULTS = {
  content_width:'standard', hero_alignment:'center', hero_size:'large',
  section_spacing:'comfortable', gallery_columns:'3', default_gallery_view:'lista', default_theme:'escuro',
  color_background:'#061522', color_surface:'#0b2943', color_text:'#eff7ff', color_muted:'#a9bdcc', color_accent:'#93c8f2',
}
const FIELDS = [
  {name:'content_width',title:'Largura do conteúdo',description:'Define quanto espaço o conteúdo ocupa em telas maiores.',options:[['compact','Enxuto','Mais foco e respiro lateral'],['standard','Equilibrado','Proporção atual'],['wide','Amplo','Mais espaço para imagens']]},
  {name:'hero_alignment',title:'Alinhamento da apresentação',description:'Escolha como o nome e a frase aparecem no topo.',options:[['center','Centralizado','Composição simétrica'],['left','À esquerda','Composição editorial']]},
  {name:'hero_size',title:'Altura da apresentação',description:'Controla o espaço reservado ao cabeçalho inicial.',options:[['compact','Compacta','Chega mais rápido ao conteúdo'],['large','Expandida','Dá destaque à identidade']]},
  {name:'section_spacing',title:'Espaçamento entre seções',description:'Ajusta o ritmo vertical entre as partes do portfólio.',options:[['compact','Compacto','Mais conteúdo na tela'],['comfortable','Confortável','Equilíbrio e respiro'],['spacious','Generoso','Mais espaço entre projetos']]},
  {name:'gallery_columns',title:'Colunas da grade',description:'Número de colunas em telas grandes. Em celulares, a grade continua adaptável.',options:[['2','2 colunas','Imagens maiores'],['3','3 colunas','Equilíbrio'],['4','4 colunas','Visão panorâmica']]},
  {name:'default_gallery_view',title:'Visualização inicial',description:'Como o visitante encontra as obras ao abrir o portfólio.',options:[['lista','Lista editorial','Mais espaço para contexto'],['grade','Grade visual','Acervo em composição única']]},
  {name:'default_theme',title:'Tema inicial',description:'O visitante ainda poderá alternar entre claro e escuro.',options:[['escuro','Escuro','Apresentação imersiva'],['claro','Claro','Apresentação luminosa']]},
]
const COLOR_FIELDS = [
  ['color_background','Fundo','Plano de fundo geral'],['color_surface','Superfícies','Cartões e áreas elevadas'],
  ['color_text','Texto principal','Títulos e informações principais'],['color_muted','Texto secundário','Legendas e informações auxiliares'],
  ['color_accent','Destaque','Links e elementos ativos'],
]
const PALETTES = [
  {name:'Azul profundo',colors:['#061522','#0b2943','#eff7ff','#a9bdcc','#93c8f2']},
  {name:'Oliva e papel',colors:['#171912','#292d20','#f1efdf','#b9b99f','#c5cf91']},
  {name:'Terracota',colors:['#211815','#382720','#fff0e5','#cdb8aa','#d98d68']},
  {name:'Galeria clara',colors:['#f5f2eb','#ffffff','#24231f','#77746c','#657c62']},
]
function readCookie(name){const prefix=name+'=';const item=document.cookie.split('; ').find(cookie=>cookie.startsWith(prefix));return item?decodeURIComponent(item.slice(prefix.length)):''}
function luminance(hex){const channels=hex.replace('#','').match(/.{2}/g).map(value=>parseInt(value,16)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722}
function contrastRatio(a,b){const values=[luminance(a),luminance(b)].sort((x,y)=>y-x);return(values[0]+.05)/(values[1]+.05)}

export function CmsLayoutManager(){
  const [settings,setSettings]=useState(DEFAULTS),[saved,setSaved]=useState(DEFAULTS),[canChange,setCanChange]=useState(false)
  const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
  const [previewMode,setPreviewMode]=useState(false)
  useEffect(()=>{
    let active=true
    fetch('/api/cms/layout/',{credentials:'same-origin',headers:{Accept:'application/json'},cache:'no-store'})
      .then(async response=>{const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(response.status===403?'Sua conta não tem permissão para acessar o layout.':'Não foi possível carregar as opções de layout.');return data})
      .then(data=>{if(!active)return;const next={...DEFAULTS,...(data.settings||{})};setSettings(next);setSaved(next);setCanChange(Boolean(data.permissions?.canChange))})
      .catch(err=>{if(active)setError(err.message)}).finally(()=>{if(active)setLoading(false)})
    return()=>{active=false}
  },[])
  const hasChanges=JSON.stringify(settings)!==JSON.stringify(saved)
  const previewUrl=useMemo(()=> '/?layout_preview='+encodeURIComponent(JSON.stringify(settings)),[settings])
  const contrast=useMemo(()=>contrastRatio(settings.color_text,settings.color_background),[settings.color_text,settings.color_background])
  const change=(name,value)=>{setSettings(current=>({...current,[name]:value}));setError('');setNotice('')}
  const applyPalette=colors=>{const [color_background,color_surface,color_text,color_muted,color_accent]=colors;setSettings(current=>({...current,color_background,color_surface,color_text,color_muted,color_accent}));setError('');setNotice('')}
  const save=async event=>{
    event.preventDefault();setSaving(true);setError('');setNotice('')
    try{
      const response=await fetch('/api/cms/layout/',{method:'PATCH',credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json','Content-Type':'application/json','X-CSRFToken':readCookie('csrftoken')},body:JSON.stringify(settings)})
      const data=await response.json().catch(()=>({}))
      if(!response.ok)throw new Error(data.error==='layout_edit_permission_required'?'Sua conta não tem permissão para alterar o layout.':'Não foi possível salvar. Tente novamente.')
      const next={...DEFAULTS,...data.settings};setSettings(next);setSaved(next);setNotice('Personalização salva. As configurações foram aplicadas ao portfólio.')
    }catch(err){setError(err.message||'Não foi possível salvar.')}finally{setSaving(false)}
  }
  const discard=()=>{setSettings(saved);setError('');setNotice('Alterações descartadas.')}
  const reset=()=>{setSettings(DEFAULTS);setError('');setNotice('')}
  if(loading)return <div className="cms-loading">Carregando opções de layout…</div>
  return <section className="cms-layout-page">
    <header className="cms-library-heading"><div><p className="cms-eyebrow">APARÊNCIA DO PORTFÓLIO</p><h1>Layout<span>.</span></h1><p>Personalize a composição e as cores vendo o resultado antes de salvar.</p></div>
      <div className="cms-layout-heading-actions"><button type="button" className="cms-secondary-link cms-layout-preview-toggle" onClick={()=>setPreviewMode(v=>!v)}>{previewMode?'← Voltar à edição':'◉ Abrir prévia'}</button><a className="cms-secondary-link" href="/" target="_blank" rel="noreferrer">Site publicado ↗</a></div>
    </header>
    <div className="cms-layout-intro"><span className="cms-layout-intro-mark" aria-hidden="true">✳</span><div><strong>Experimente sem medo</strong><p>As mudanças aparecem na prévia e ficam apenas neste editor até você salvar. Testar combinações não altera o site publicado.</p></div></div>
    <div className={'cms-layout-workspace'+(previewMode?' preview-focused':'')}>
      <form className="cms-layout-form" onSubmit={save}>
        <div className="cms-save-state" role="status" aria-live="polite"><span className="cms-save-state-dot"/>{hasChanges?'Alterações ainda não salvas':'Tudo salvo'}</div>
        <section className="cms-layout-color-panel">
          <div className="cms-layout-section-heading"><div><p className="cms-eyebrow">IDENTIDADE VISUAL</p><h2>Cores do portfólio</h2></div><span className="cms-layout-color-chip" style={{background:settings.color_accent}}/></div>
          <p className="cms-layout-help">Escolha uma paleta ou ajuste cada cor individualmente.</p>
          <div className="cms-layout-palettes">{PALETTES.map(palette=><button type="button" className="cms-layout-palette" key={palette.name} onClick={()=>applyPalette(palette.colors)} aria-label={'Aplicar paleta '+palette.name}><span className="cms-layout-palette-swatches">{palette.colors.map(color=><i key={color} style={{background:color}}/>)}</span><strong>{palette.name}</strong></button>)}</div>
          <div className="cms-layout-colors">{COLOR_FIELDS.map(([name,label,detail])=><label className="cms-layout-color-field" key={name}><span><strong>{label}</strong><small>{detail}</small></span><span className="cms-layout-color-input"><input type="color" value={settings[name]} onChange={event=>change(name,event.target.value)} disabled={!canChange||saving} aria-label={label}/><code>{settings[name].toUpperCase()}</code></span></label>)}</div>
          <div className={'cms-layout-contrast '+(contrast>=4.5?'good':'warning')} role="status"><span>{contrast>=4.5?'✓':'!'}</span><div><strong>{contrast>=4.5?'Bom contraste de texto':'Contraste abaixo do recomendado'}</strong><small>{'Relação de contraste: '+contrast.toFixed(2)+':1. Para texto comum, procure pelo menos 4,5:1.'}</small></div></div>
        </section>
        <div className="cms-layout-fields">{FIELDS.map(field=><fieldset className="cms-layout-field" key={field.name} disabled={!canChange||saving}><legend>{field.title}</legend><p>{field.description}</p><div className="cms-layout-options">{field.options.map(([value,label,detail])=><label className={'cms-layout-option'+(settings[field.name]===value?' selected':'')} key={value}><input type="radio" name={field.name} value={value} checked={settings[field.name]===value} onChange={()=>change(field.name,value)}/><span className="cms-layout-option-copy"><strong>{label}</strong><small>{detail}</small></span><span className="cms-layout-option-check" aria-hidden="true">✓</span></label>)}</div></fieldset>)}</div>
        {error&&<div className="cms-editor-message error" role="alert">{error}</div>}{notice&&<div className="cms-editor-message success" role="status">{notice}</div>}
        <div className="cms-editor-actions"><span>{canChange?'Salvar aplica as escolhas ao portfólio público.':'Você tem acesso de leitura às opções de layout.'}</span><div className="cms-editor-save-actions"><button className="cms-editor-cancel" type="button" onClick={discard} disabled={!hasChanges||saving}>Descartar</button><button className="cms-editor-cancel" type="button" onClick={reset} disabled={!canChange||saving||!hasChanges}>Restaurar padrão</button><button className="cms-primary-button" type="submit" disabled={!canChange||saving||!hasChanges}>{saving?'Salvando…':'Salvar personalização'} <span>↗</span></button></div></div>
      </form>
      <aside className="cms-layout-preview-panel" aria-label="Prévia ao vivo do portfólio"><div className="cms-layout-preview-heading"><div><p className="cms-eyebrow">VISUALIZAÇÃO AO VIVO</p><strong>Seu portfólio</strong></div><span>Não publicado</span></div><div className="cms-layout-preview-frame"><iframe key={previewUrl} title="Prévia do portfólio com as configurações atuais" src={previewUrl} loading="lazy"/></div><p className="cms-layout-preview-caption">Prévia do site real com as configurações atuais. Navegue e confira as obras; nada será publicado até salvar.</p></aside>
    </div>
  </section>
}
