import React from 'react'
import './CmsPageComposer.css'

const BLOCKS = [
  ['hero','Abertura / Hero'],['about','Sobre / Biografia'],['gallery','Galeria de trabalhos'],
  ['featured-work','Obra em destaque'],['rich-text','Texto editorial'],['image','Imagem em destaque'],
  ['tattoo-flash','Flash / Coleção'],['references','Exposições e referências'],['contact','Contato'],
]
const makeId = prefix => prefix + '-' + Math.random().toString(36).slice(2,8)
const DEFAULT_SCHEMA = {version:1,pages:[{id:'home',slug:'inicio',title:'Início',published:true,sections:[
  {id:'opening',type:'hero',settings:{title:'Seu nome, sua linguagem',eyebrow:'PORTFÓLIO AUTORAL',align:'left',width:'wide'}},
  {id:'about',type:'about',settings:{show_image:true,show_bio:true}},
  {id:'works',type:'gallery',settings:{title:'Trabalhos selecionados',width:'wide'}},
  {id:'contact',type:'contact',settings:{title:'Vamos conversar?'}},
]}]}

export function CmsPageComposer({value,onChange}) {
  const schema=value?.version===1&&Array.isArray(value.pages)?value:DEFAULT_SCHEMA
  const update=pages=>onChange({version:1,pages})
  const patchPage=(pageId,patch)=>update(schema.pages.map(page=>page.id===pageId?{...page,...patch}:page))
  const patchSection=(pageId,sectionId,patch)=>update(schema.pages.map(page=>page.id!==pageId?page:{...page,sections:page.sections.map(section=>section.id===sectionId?{...section,...patch}:section)}))
  const patchSettings=(pageId,sectionId,patch)=>update(schema.pages.map(page=>page.id!==pageId?page:{...page,sections:page.sections.map(section=>section.id!==sectionId?section:{...section,settings:{...section.settings,...patch}})}))
  const addPage=()=>{const id=makeId('page');update([...schema.pages,{id,slug:id,title:'Nova página',published:true,sections:[{id:makeId('hero'),type:'hero',settings:{title:'Nova página',align:'left',width:'wide'}}]}])}
  const addSection=(pageId,type)=>update(schema.pages.map(page=>page.id!==pageId?page:{...page,sections:[...page.sections,{id:makeId(type),type,settings:{title:BLOCKS.find(item=>item[0]===type)?.[1]||'Nova seção',width:'standard'}}]}))
  const moveSection=(pageId,index,delta)=>update(schema.pages.map(page=>{if(page.id!==pageId)return page;const sections=[...page.sections],target=index+delta;if(target<0||target>=sections.length)return page;[sections[index],sections[target]]=[sections[target],sections[index]];return {...page,sections}}))
  const removeSection=(pageId,sectionId)=>update(schema.pages.map(page=>page.id===pageId?{...page,sections:page.sections.filter(section=>section.id!==sectionId)}:page))
  const removePage=pageId=>update(schema.pages.filter(page=>page.id!==pageId))
  const active=value?.version===1&&Array.isArray(value.pages)
  return <section className="cms-page-composer">
    <header><div><p className="cms-eyebrow">NOVA ARQUITETURA · COMPOSIÇÃO LIVRE</p><h2>Construtor de páginas</h2><p>Crie páginas independentes e monte cada uma com seções próprias. O modelo autoral da Luli continua separado e intacto.</p></div><button type="button" className="cms-secondary-button" onClick={()=>onChange(active?null:DEFAULT_SCHEMA)}>{active?'Desativar construtor':'Criar composição independente'}</button></header>
    {!active?<div className="cms-page-composer-empty"><strong>Seu portfólio ainda usa o modelo autoral atual.</strong><span>Ative o construtor quando quiser criar uma experiência com estrutura própria. Isso não altera o site até salvar.</span></div>:<>
      <div className="cms-page-composer-toolbar"><span>{schema.pages.length} página(s) · {schema.pages.reduce((sum,page)=>sum+page.sections.length,0)} seções</span><button type="button" className="cms-secondary-button" onClick={addPage}>＋ Adicionar página</button></div>
      {schema.pages.map(page=><article className="cms-composer-page" key={page.id}>
        <div className="cms-composer-page-fields"><label>Nome da página<input value={page.title} maxLength={100} onChange={event=>patchPage(page.id,{title:event.target.value})}/></label><label>Endereço / slug<input value={page.slug} maxLength={48} pattern="[a-z0-9-]+" onChange={event=>patchPage(page.id,{slug:event.target.value.toLowerCase().replace(/[^a-z0-9-]/g,'-')})}/></label>{schema.pages.length>1&&<button type="button" className="cms-composer-remove" onClick={()=>removePage(page.id)}>Excluir página</button>}</div>
        <div className="cms-composer-sections">{page.sections.map((section,index)=><div className="cms-composer-block" key={section.id}>
          <div className="cms-composer-block-heading"><strong>{index+1}. {BLOCKS.find(item=>item[0]===section.type)?.[1]||section.type}</strong><div><button type="button" disabled={index===0} onClick={()=>moveSection(page.id,index,-1)} aria-label="Mover seção para cima">↑</button><button type="button" disabled={index===page.sections.length-1} onClick={()=>moveSection(page.id,index,1)} aria-label="Mover seção para baixo">↓</button><button type="button" onClick={()=>removeSection(page.id,section.id)} aria-label="Remover seção">×</button></div></div>
          <div className="cms-composer-block-fields"><label>Título<input value={section.settings.title||''} maxLength={180} onChange={event=>patchSettings(page.id,section.id,{title:event.target.value})}/></label><label>Texto / descrição<textarea rows="2" value={section.settings.body||''} maxLength={5000} onChange={event=>patchSettings(page.id,section.id,{body:event.target.value})}/></label><label>Alinhamento<select value={section.settings.align||'left'} onChange={event=>patchSettings(page.id,section.id,{align:event.target.value})}><option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option></select></label><label>Largura<select value={section.settings.width||'standard'} onChange={event=>patchSettings(page.id,section.id,{width:event.target.value})}><option value="narrow">Estreita</option><option value="standard">Padrão</option><option value="wide">Ampla</option></select></label>{section.type==='image'&&<label>Imagem (URL)<input value={section.settings.image_url||''} type="url" placeholder="https://" onChange={event=>patchSettings(page.id,section.id,{image_url:event.target.value})}/></label>}{section.type==='gallery'&&<label>Categoria (chave opcional)<input value={section.settings.category_key||''} placeholder="Todas as categorias" onChange={event=>patchSettings(page.id,section.id,{category_key:event.target.value})}/></label>}</div>
        </div>)}</div>
        <div className="cms-composer-add-block"><label>Adicionar seção<select defaultValue="" onChange={event=>{if(event.target.value)addSection(page.id,event.target.value);event.target.value=''}}><option value="">Escolha um bloco…</option>{BLOCKS.map(([type,label])=><option value={type} key={type}>{label}</option>)}</select></label></div>
      </article>)}
    </>}
  </section>
}
