import React, { useMemo, useState } from 'react'
import './CmsPageComposer.css'

const BLOCKS = [
  ['hero','Abertura','Identidade e primeira impressão'],['about','Sobre','Biografia e trajetória'],
  ['gallery','Galeria','Séries e trabalhos'],['featured-work','Obra em destaque','Uma peça protagonista'],
  ['rich-text','Texto editorial','Manifesto, processo ou apresentação'],['image','Imagem','Imagem em largura editorial'],
  ['tattoo-flash','Flash de tatuagem','Coleções, disponibilidade e valores'],
  ['references','Referências','Exposições, publicações e formação'],['contact','Contato','Formulário e canais de contato'],
]
const makeId = prefix => prefix+'-'+Math.random().toString(36).slice(2,8)
const DEFAULT_SCHEMA = {version:1,pages:[{id:'home',slug:'inicio',title:'Início',published:true,sections:[
  {id:'opening',type:'hero',settings:{title:'Seu nome, sua linguagem',eyebrow:'PORTFÓLIO AUTORAL',align:'left',width:'wide'}},
  {id:'works',type:'gallery',settings:{title:'Trabalhos selecionados',width:'wide'}},
  {id:'contact',type:'contact',settings:{title:'Vamos conversar?'}}
]}]}
const defaults = type => ({hero:{title:'Sua apresentação',eyebrow:'PORTFÓLIO AUTORAL',body:''},about:{title:'Sobre',show_image:true,show_bio:true},gallery:{title:'Trabalhos selecionados',layout:'editorial'},'featured-work':{title:'Obra em destaque'},'rich-text':{title:'Texto editorial',body:''},image:{title:'Imagem',image_url:'',alt:'',caption:'',ratio:'landscape'},'tattoo-flash':{title:'Flash disponíveis'},references:{title:'Referências'},contact:{title:'Contato'}}[type]||{})
const label = type => BLOCKS.find(item=>item[0]===type)?.[1]||type

function Field({label,children,wide=false}) { return <label className={'cms-page-field'+(wide?' wide':'')}><span>{label}</span>{children}</label> }

export function CmsPageComposer({value,onChange}) {
  const schema=value?.version===1&&Array.isArray(value.pages)?value:DEFAULT_SCHEMA
  const [selectedPage,setSelectedPage]=useState(schema.pages[0]?.id||'home')
  const [selectedSection,setSelectedSection]=useState(schema.pages[0]?.sections?.[0]?.id||'')
  const [adding,setAdding]=useState(false)
  const page=schema.pages.find(item=>item.id===selectedPage)||schema.pages[0]
  const section=page?.sections.find(item=>item.id===selectedSection)
  const sectionItems=Array.isArray(section?.items)?section.items:[]
  const updateItem=(index,patch)=>patchSection(section.id,{items:sectionItems.map((item,itemIndex)=>itemIndex===index?{...item,...patch}:item)})
  const addItem=()=>patchSection(section.id,{items:[...sectionItems,{title:''}]})
  const removeItem=index=>patchSection(section.id,{items:sectionItems.filter((item,itemIndex)=>itemIndex!==index)})
  const update=pages=>onChange({version:1,pages})
  const patchPage=(id,patch)=>update(schema.pages.map(item=>item.id===id?{...item,...patch}:item))
  const patchSection=(id,patch)=>update(schema.pages.map(item=>item.id!==page.id?item:{...item,sections:item.sections.map(part=>part.id===id?{...part,...patch}:part)}))
  const patchSettings=(id,patch)=>patchSection(id,{settings:{...section.settings,...patch}})
  const addPage=()=>{const id=makeId('page');update([...schema.pages,{id,slug:id,title:'Nova página',published:true,sections:[]}]);setSelectedPage(id);setSelectedSection('')}
  const addSection=type=>{const item={id:makeId(type),type,settings:defaults(type)};update(schema.pages.map(p=>p.id===page.id?{...p,sections:[...p.sections,item]}:p));setSelectedSection(item.id);setAdding(false)}
  const move=(index,delta)=>{const sections=[...page.sections],to=index+delta;if(to<0||to>=sections.length)return;[sections[index],sections[to]]=[sections[to],sections[index]];patchPage(page.id,{sections})}
  const removeSection=id=>{const sections=page.sections.filter(item=>item.id!==id);patchPage(page.id,{sections});if(selectedSection===id)setSelectedSection(sections[0]?.id||'')}
  const removePage=()=>{const pages=schema.pages.filter(item=>item.id!==page.id);update(pages);setSelectedPage(pages[0]?.id||'');setSelectedSection(pages[0]?.sections?.[0]?.id||'')}
  const active=value?.version===1&&Array.isArray(value.pages)
  const pageCount=schema.pages.length
  const selectedIndex=page?.sections.findIndex(item=>item.id===selectedSection)??-1
  const selectPage=id=>{setSelectedPage(id);const next=schema.pages.find(item=>item.id===id);setSelectedSection(next?.sections?.[0]?.id||'')}
  const commonFields=section&&<>
    <Field label="Título"><input value={section.settings.title||''} maxLength={180} onChange={e=>patchSettings(section.id,{title:e.target.value})}/></Field>
    <Field label="Linha de apoio"><input value={section.settings.eyebrow||''} maxLength={100} onChange={e=>patchSettings(section.id,{eyebrow:e.target.value})}/></Field>
    <Field label="Texto / descrição" wide><textarea rows="5" value={section.settings.body||''} maxLength={5000} onChange={e=>patchSettings(section.id,{body:e.target.value})} placeholder="Escreva o conteúdo desta sessão…"/></Field>
  </>
  return <section className="cms-page-composer">
    <header className="cms-pages-heading"><div><p className="cms-eyebrow">ESTRUTURA DO PORTFÓLIO</p><h2>Páginas e sessões</h2><p>Organize a estrutura no menu lateral. Selecione uma sessão para editar somente o conteúdo dela.</p></div><span className="cms-pages-count">{pageCount} {pageCount===1?'página':'páginas'}</span></header>
    {!active?<div className="cms-page-composer-empty"><strong>O portfólio ainda usa a estrutura atual.</strong><span>Ative a estrutura independente para criar páginas e sessões sem alterar o layout visual.</span><button type="button" className="cms-primary-button" onClick={()=>onChange(DEFAULT_SCHEMA)}>Ativar páginas independentes</button></div>:<div className="cms-pages-workspace">
      <aside className="cms-pages-tree" aria-label="Páginas e sessões">
        <div className="cms-pages-tree-top"><span>PÁGINAS</span><button type="button" onClick={addPage} aria-label="Adicionar página">＋</button></div>
        {schema.pages.map(item=><div className={'cms-pages-tree-page'+(item.id===page?.id?' active':'')} key={item.id}>
          <button type="button" className="cms-pages-tree-page-button" onClick={()=>selectPage(item.id)}><span className="cms-pages-tree-page-icon">▤</span><span>{item.title||'Sem título'}</span></button>
          {item.id===page?.id&&<div className="cms-pages-tree-sections">{item.sections.map((part,index)=><div className={'cms-pages-tree-section'+(part.id===selectedSection?' active':'')} key={part.id}><button type="button" onClick={()=>setSelectedSection(part.id)}><span>◦</span>{label(part.type)}</button><div className="cms-pages-tree-order"><button type="button" disabled={index===0} onClick={()=>move(index,-1)} aria-label="Mover sessão para cima">↑</button><button type="button" disabled={index===item.sections.length-1} onClick={()=>move(index,1)} aria-label="Mover sessão para baixo">↓</button></div></div>)}
          <button type="button" className="cms-pages-add-section" onClick={()=>setAdding(v=>!v)}>＋ Adicionar sessão</button>
          {adding&&<div className="cms-pages-add-menu">{BLOCKS.map(([type,name,desc])=><button type="button" key={type} onClick={()=>addSection(type)}><strong>{name}</strong><small>{desc}</small></button>)}</div>}
          </div>}
        </div>)}
        {active&&<button type="button" className="cms-pages-disable" onClick={()=>onChange(null)}>Desativar estrutura independente</button>}
      </aside>
      <div className="cms-pages-editor">
        {!section?<div className="cms-pages-editor-empty"><span>＋</span><h3>Monte esta página</h3><p>Adicione sessões pelo menu lateral. Você pode criar uma abertura, uma galeria, textos editoriais, flash de tatuagem e muito mais.</p><button type="button" className="cms-primary-button" onClick={()=>setAdding(true)}>Adicionar primeira sessão</button></div>:<>
          <div className="cms-pages-editor-top"><div><p className="cms-eyebrow">EDITANDO SESSÃO {String(selectedIndex+1).padStart(2,'0')}</p><h3>{label(section.type)}</h3><p>O conteúdo desta sessão é editado aqui. A aparência é controlada na área Layout.</p></div><button type="button" className="cms-composer-remove" onClick={()=>removeSection(section.id)}>Remover sessão</button></div>
          <div className="cms-pages-editor-fields">
            {section.type==='hero'?<>{commonFields}<Field label="Botão / chamada"><input value={section.settings.cta_label||''} onChange={e=>patchSettings(section.id,{cta_label:e.target.value})} placeholder="Ex.: Conheça meu trabalho"/></Field><Field label="Destino do botão"><input value={section.settings.cta_url||''} onChange={e=>patchSettings(section.id,{cta_url:e.target.value})} placeholder="#contato ou https://…"/></Field></>:section.type==='about'?<>{commonFields}<Field label="Exibir imagem"><select value={String(section.settings.show_image!==false)} onChange={e=>patchSettings(section.id,{show_image:e.target.value==='true'})}><option value="true">Sim</option><option value="false">Não</option></select></Field><Field label="Exibir biografia"><select value={String(section.settings.show_bio!==false)} onChange={e=>patchSettings(section.id,{show_bio:e.target.value==='true'})}><option value="true">Sim</option><option value="false">Não</option></select></Field></>:section.type==='gallery'?<>{commonFields}<Field label="Categoria"><input value={section.settings.category_key||''} onChange={e=>patchSettings(section.id,{category_key:e.target.value})} placeholder="Todas as categorias"/></Field></>:section.type==='image'?<>{commonFields}<Field label="Endereço da imagem" wide><input value={section.settings.image_url||''} onChange={e=>patchSettings(section.id,{image_url:e.target.value})} placeholder="https://…"/></Field><Field label="Texto alternativo"><input value={section.settings.alt||''} onChange={e=>patchSettings(section.id,{alt:e.target.value})}/></Field><Field label="Legenda"><input value={section.settings.caption||''} onChange={e=>patchSettings(section.id,{caption:e.target.value})}/></Field></>:section.type==='featured-work'?<>{commonFields}<Field label="Obra (título exato)"><input value={section.settings.work_title||''} onChange={e=>patchSettings(section.id,{work_title:e.target.value})}/></Field></>:section.type==='rich-text'?commonFields:section.type==='tattoo-flash'||section.type==='references'?<>{commonFields}<div className="cms-pages-items-editor"><header><div><strong>{section.type==='tattoo-flash'?'Itens da coleção':'Referências e trajetória'}</strong><small>{sectionItems.length} {sectionItems.length===1?'item':'itens'}</small></div><button type="button" onClick={addItem}>＋ Adicionar item</button></header>{sectionItems.map((item,index)=><article className="cms-pages-item-card" key={index}><div className="cms-pages-item-heading"><strong>{item.title||'Novo item '+(index+1)}</strong><button type="button" className="cms-composer-remove" onClick={()=>removeItem(index)}>Remover</button></div><Field label="Título"><input value={item.title||''} maxLength={120} onChange={e=>updateItem(index,{title:e.target.value})}/></Field><Field label="Descrição" wide><textarea rows="3" value={item.description||''} maxLength={1200} onChange={e=>updateItem(index,{description:e.target.value})}/></Field><Field label="Imagem (URL)" wide><input value={item.image_url||''} maxLength={500} placeholder="https://…" onChange={e=>updateItem(index,{image_url:e.target.value})}/></Field>{(section.type==='tattoo-flash'?[['size','Tamanho'],['placement','Local sugerido'],['price','Valor'],['status','Disponibilidade']]:[['period','Período'],['venue','Instituição / espaço'],['location','Cidade / local']]).map(([key,label])=><Field label={label} key={key}><input value={item[key]||''} maxLength={180} onChange={e=>updateItem(index,{[key]:e.target.value})}/></Field>)}<Field label="Link externo" wide><input value={item.link_url||''} maxLength={500} placeholder="https://…" onChange={e=>updateItem(index,{link_url:e.target.value})}/></Field></article>)}</div></>:<>{commonFields}<p className="cms-pages-field-note">Os dados do formulário e canais de contato vêm das configurações de Perfil e Conteúdo.</p></>}
          </div>
        </>}
        <div className="cms-pages-page-settings"><div><p className="cms-eyebrow">PÁGINA ATUAL</p><h4>Configurações da página</h4></div><div className="cms-pages-page-fields"><Field label="Nome no menu"><input value={page?.title||''} onChange={e=>patchPage(page.id,{title:e.target.value})}/></Field><Field label="Endereço (slug)"><input value={page?.slug||''} pattern="[a-z0-9-]+" onChange={e=>patchPage(page.id,{slug:e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,'-')})}/></Field><Field label="Publicação"><select value={String(page?.published!==false)} onChange={e=>patchPage(page.id,{published:e.target.value==='true'})}><option value="true">Publicada</option><option value="false">Rascunho</option></select></Field>{pageCount>1&&<button type="button" className="cms-composer-remove" onClick={removePage}>Excluir página</button>}</div></div>
      </div>
    </div>}
  </section>
}
