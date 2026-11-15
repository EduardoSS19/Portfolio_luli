import React, { useEffect, useState } from 'react'
import { Sobre } from '../components/Sobre.jsx'
import { SecaoCategoria } from '../components/SecaoCategoria.jsx'
import { GaleriaGrade } from '../components/GaleriaGrade.jsx'
import { Referencias } from '../components/Referencias.jsx'
import { Contato } from '../components/Contato.jsx'
import { Footer } from '../components/Footer.jsx'

const SECTION_TYPES = new Set(['hero','about','gallery','featured-work','rich-text','image','references','contact','tattoo-flash','custom'])
const text = (value, fallback = '') => typeof value === 'string' ? value : fallback

function Section({ section, data, preview }) {
  const settings = section.settings || {}
  const categories = data.categorias || []
  const works = categories.flatMap(category => (category.obras || []).map(work => ({ ...work, categoria: category })))
  const category = categories.find(item => item.chave === settings.category_key)
  const custom = (data.layout?.custom_sections || []).find(item => item.id === settings.custom_section_id) || (section.type === 'tattoo-flash' ? (data.layout?.custom_sections || []).find(item => item.type === 'tattoo-flash') : null)
  const items = Array.isArray(section.items) ? section.items : (custom?.items || [])
  const contentWidth=settings.width||data.layout?.content_width||'standard'
  const sectionAlignment=settings.align||(section.type==='hero'?data.layout?.hero_alignment:'left')||'left'
  const style = { '--section-width': contentWidth === 'wide' ? 'min(100% - 3rem, 1600px)' : contentWidth === 'compact' || contentWidth === 'narrow' ? 'min(100% - 3rem, 760px)' : 'min(100% - 3rem, 1180px)', '--section-align': sectionAlignment === 'center' ? 'center' : sectionAlignment === 'right' ? 'right' : 'left' }
  const title = text(settings.title, section.type === 'gallery' ? category?.titulo || 'Trabalhos' : '')
  if (!SECTION_TYPES.has(section.type)) return null
  if (section.type === 'hero') return <section id={section.id} className={"composer-section composer-hero hero-size-" + (data.layout?.hero_size || "large")} style={style}><span>{text(settings.eyebrow, data.sobre?.frase)}</span><h1>{text(settings.title, data.sobre?.nome)}</h1>{settings.show_description !== false && <p>{text(settings.body, data.sobre?.bio)}</p>}{settings.cta_label && <a className="composer-cta" href={text(settings.cta_url, '#contato')}>{settings.cta_label}</a>}</section>
  if (section.type === 'about') return <section id={section.id} className="composer-section" style={style}><Sobre perfil={data.sobre || {}} mostrarImagem={settings.show_image !== false} mostrarBio={settings.show_bio !== false}/></section>
  if (section.type === 'gallery') return <section id={section.id} className={`composer-section composer-gallery composer-gallery-${settings.layout || 'editorial'}`} style={style}><header><span>{text(settings.eyebrow, 'PORTFÓLIO')}</span><h2>{title}</h2>{settings.body && <p>{settings.body}</p>}</header>{category ? <SecaoCategoria titulo={category.titulo} chave={category.chave} animacao={category.animacao} obras={category.obras || []}/> : data.layout?.default_gallery_view === 'grade' ? <GaleriaGrade categorias={categories}/> : categories.map((item,index)=><SecaoCategoria key={item.chave||index} titulo={item.titulo} chave={item.chave} animacao={item.animacao} obras={item.obras||[]} indice={index}/>)}</section>
  if (section.type === 'featured-work') { const work = works.find(item => item.titulo === settings.work_title) || works[0]; if (!work) return null; return <section id={section.id} className="composer-section composer-featured" style={style}><span>{text(settings.eyebrow, 'EM DESTAQUE')}</span><h2>{text(settings.title, work.titulo)}</h2><p>{text(settings.body, work.descricao)}</p><div className="composer-featured-image">{work.imagem && <img src={work.imagem} alt={work.titulo}/>}</div></section> }
  if (section.type === 'rich-text') return <section id={section.id} className="composer-section composer-rich-text" style={style}><span>{text(settings.eyebrow, 'NOTAS')}</span>{title && <h2>{title}</h2>}<div>{text(settings.body).split('\n').map((line,index)=><p key={index}>{line}</p>)}</div></section>
  if (section.type === 'image') return <figure id={section.id} className={`composer-section composer-image composer-image-${settings.ratio || 'landscape'}`} style={style}>{settings.image_url && <img src={settings.image_url} alt={text(settings.alt, title)}/ >}{settings.caption && <figcaption>{settings.caption}</figcaption>}</figure>
  if (section.type === 'references') return <section id={section.id} className="composer-section composer-references" style={style}><header><span>{text(settings.eyebrow,'TRAJETÓRIA')}</span><h2>{text(settings.title,'Referências')}</h2>{settings.body&&<p>{settings.body}</p>}</header>{items.length?<div className="composer-custom-grid">{items.map((item,index)=><article key={item.title+index}>{item.image_url&&<img src={item.image_url} alt={item.title}/>}<h3>{item.title}</h3>{item.period&&<small>{item.period}</small>}{item.venue&&<small>{item.venue}</small>}{item.location&&<small>{item.location}</small>}{item.description&&<p>{item.description}</p>}{item.link_url&&<a href={item.link_url} target="_blank" rel="noreferrer">Saiba mais ↗</a>}</article>)}</div>:<Referencias referencias={data.referencias || []}/>}</section>
  if (section.type === 'contact') return <section id={section.id} className="composer-section" style={style}><Contato endpoint={data.sobre?.formulario} email={data.sobre?.email} demoMode={preview}/></section>
  if (section.type === 'tattoo-flash' || section.type === 'custom') return <section id={section.id} className="composer-section composer-custom" style={style}><span>{text(settings.eyebrow, 'COLEÇÃO')}</span><h2>{text(settings.title, custom?.title || 'Coleção')}</h2>{text(settings.body, custom?.intro) && <p>{text(settings.body, custom?.intro)}</p>}<div className="composer-custom-grid">{items.map((item,index)=><article key={item.title + index}>{(item.image_url||item.image)&&<img src={item.image_url||item.image} alt={item.title}/>}<h3>{item.title}</h3>{item.description&&<p>{item.description}</p>}{item.size&&<small>{item.size}</small>}{item.placement&&<small>{item.placement}</small>}{item.status&&<small>{item.status}</small>}{item.price&&<small>{item.price}</small>}{(item.link_url||item.url)&&<a href={item.link_url||item.url} target="_blank" rel="noreferrer">Consultar disponibilidade ↗</a>}</article>)}</div></section>
  return null
}

function PortfolioNavigation({ pages, activePage, profile, mode }) {
  const [open,setOpen]=useState(false)
  const expandable=['curtain','dropdown','sidebar','index'].includes(mode)
  useEffect(()=>{if(!open)return undefined;const closeOnEscape=event=>{if(event.key==='Escape')setOpen(false)};window.addEventListener('keydown',closeOnEscape);return()=>window.removeEventListener('keydown',closeOnEscape)},[open])
  const label=mode==='curtain'?'Abrir navegação':mode==='sidebar'?'Abrir índice lateral':mode==='index'?'Abrir índice de capítulos':'Abrir menu'
  return <nav className={"composer-navigation nav-style-"+mode+(open?' is-open':'')} aria-label="Navegação do portfólio">
    <div className="composer-navigation-bar">
      <a className="composer-brand" href="/">{profile.nome||'Portfólio'}</a>
      {expandable&&<button type="button" className="composer-navigation-toggle" aria-expanded={open} aria-label={open?'Fechar navegação':label} onClick={()=>setOpen(value=>!value)}><span>{open?'Fechar':'Explorar'}</span><i aria-hidden="true">{open?'×':'＋'}</i></button>}
    </div>
    <div className="composer-navigation-links" aria-hidden={expandable&&!open}>
      {pages.map((page,index)=><a key={page.id} href={page.slug==='inicio'?'/':`/${page.slug}`} aria-current={page.id===activePage.id?'page':undefined} onClick={()=>setOpen(false)}><span className="composer-navigation-number">{String(index+1).padStart(2,'0')}</span>{page.title}</a>)}
    </div>
  </nav>
}

export function PageRenderer({ pages = [], data, preview = false }) {
  const path = window.location.pathname.replace(/^\\/+|\\/+$/g, '')
  const publishedPages = pages.filter(page => page.published !== false)
  const activePage = publishedPages.find(page => page.slug === path) || (!path ? publishedPages.find(page => page.slug === 'inicio') || publishedPages[0] : null)
  if (!activePage) return <main className="composer-site composer-not-found"><h1>Esta página não existe.</h1><a href="/">Voltar ao início</a></main>
  const profile = data.sobre || {}
  const mode=data.layout?.presentation_mode||'editorial'
  const navigationMode=data.layout?.navigation_mode||'curtain'
  return <main className={"composer-site mode-"+mode+" nav-"+navigationMode+" spacing-"+(data.layout?.section_spacing||"comfortable")+" width-"+(data.layout?.content_width||"standard")} style={{"--composer-gallery-columns":data.layout?.gallery_columns||"3"}} id="topo">
    <PortfolioNavigation pages={publishedPages} activePage={activePage} profile={profile} mode={navigationMode}/>
    {(activePage.sections || []).map(section=><Section key={section.id} section={section} data={data} preview={preview}/>)}
    <Footer nome={profile.nome} instagram={profile.instagram} email={profile.email} redes={data.redes || []}/>
  </main>
}
