import React from 'react'
import { Sobre } from '../components/Sobre.jsx'
import { SecaoCategoria } from '../components/SecaoCategoria.jsx'
import { GaleriaGrade } from '../components/GaleriaGrade.jsx'
import { Referencias } from '../components/Referencias.jsx'
import { Contato } from '../components/Contato.jsx'

const SECTION_TYPES = new Set(['hero','about','gallery','featured-work','rich-text','image','references','contact','tattoo-flash','custom'])
const text = (value, fallback = '') => typeof value === 'string' ? value : fallback

function Section({ section, data, preview }) {
  const settings = section.settings || {}
  const categories = data.categorias || []
  const works = categories.flatMap(category => (category.obras || []).map(work => ({ ...work, categoria: category })))
  const category = categories.find(item => item.chave === settings.category_key)
  const custom = (data.layout?.custom_sections || []).find(item => item.id === settings.custom_section_id)
  const style = { '--section-width': settings.width === 'wide' ? 'min(100% - 3rem, 1600px)' : settings.width === 'narrow' ? 'min(100% - 3rem, 760px)' : 'min(100% - 3rem, 1180px)', '--section-align': settings.align === 'center' ? 'center' : settings.align === 'right' ? 'right' : 'left' }
  const title = text(settings.title, section.type === 'gallery' ? category?.titulo || 'Trabalhos' : '')
  if (!SECTION_TYPES.has(section.type)) return null
  if (section.type === 'hero') return <section id={section.id} className="composer-section composer-hero" style={style}><span>{text(settings.eyebrow, data.sobre?.frase)}</span><h1>{text(settings.title, data.sobre?.nome)}</h1>{settings.show_description !== false && <p>{text(settings.body, data.sobre?.bio)}</p>}{settings.cta_label && <a className="composer-cta" href={text(settings.cta_url, '#contato')}>{settings.cta_label}</a>}</section>
  if (section.type === 'about') return <section id={section.id} className="composer-section" style={style}><Sobre perfil={data.sobre || {}} mostrarImagem={settings.show_image !== false} mostrarBio={settings.show_bio !== false}/></section>
  if (section.type === 'gallery') return <section id={section.id} className={`composer-section composer-gallery composer-gallery-${settings.layout || 'editorial'}`} style={style}><header><span>{text(settings.eyebrow, 'PORTFÓLIO')}</span><h2>{title}</h2>{settings.body && <p>{settings.body}</p>}</header>{category ? <SecaoCategoria titulo={category.titulo} chave={category.chave} animacao={category.animacao} obras={category.obras || []}/> : <GaleriaGrade categorias={categories}/>}</section>
  if (section.type === 'featured-work') { const work = works.find(item => item.titulo === settings.work_title) || works[0]; if (!work) return null; return <section id={section.id} className="composer-section composer-featured" style={style}><span>{text(settings.eyebrow, 'EM DESTAQUE')}</span><h2>{text(settings.title, work.titulo)}</h2><p>{text(settings.body, work.descricao)}</p><div className="composer-featured-image">{work.imagem && <img src={work.imagem} alt={work.titulo}/>}</div></section> }
  if (section.type === 'rich-text') return <section id={section.id} className="composer-section composer-rich-text" style={style}><span>{text(settings.eyebrow, 'NOTAS')}</span>{title && <h2>{title}</h2>}<div>{text(settings.body).split('\n').map((line,index)=><p key={index}>{line}</p>)}</div></section>
  if (section.type === 'image') return <figure id={section.id} className={`composer-section composer-image composer-image-${settings.ratio || 'landscape'}`} style={style}>{settings.image_url && <img src={settings.image_url} alt={text(settings.alt, title)}/ >}{settings.caption && <figcaption>{settings.caption}</figcaption>}</figure>
  if (section.type === 'references') return <section id={section.id} className="composer-section" style={style}><Referencias referencias={data.referencias || []}/></section>
  if (section.type === 'contact') return <section id={section.id} className="composer-section" style={style}><Contato endpoint={data.sobre?.formulario} email={data.sobre?.email} demoMode={preview}/></section>
  if (section.type === 'tattoo-flash' || section.type === 'custom') return <section id={section.id} className="composer-section composer-custom" style={style}><span>{text(settings.eyebrow, 'COLEÇÃO')}</span><h2>{text(settings.title, custom?.title || 'Coleção')}</h2>{text(settings.body, custom?.intro) && <p>{text(settings.body, custom?.intro)}</p>}<div className="composer-custom-grid">{(custom?.items || []).map((item,index)=><article key={item.title + index}>{item.image && <img src={item.image} alt={item.title}/>}<h3>{item.title}</h3>{item.description && <p>{item.description}</p>}{item.status && <small>{item.status}</small>}{item.price && <small>{item.price}</small>}</article>)}</div></section>
  return null
}

export function PageRenderer({ pages = [], data, preview = false }) {
  const path = window.location.pathname.replace(/^\\/+|\\/+$/g, '')
  const activePage = pages.find(page => page.slug === path) || pages.find(page => page.slug === 'inicio') || pages[0]
  if (!activePage) return null
  const profile = data.sobre || {}
  const navigation = pages.filter(page => page.published !== false)
  return <main className="composer-site" id="topo">
    <nav className="composer-navigation" aria-label="Navegação do portfólio"><a className="composer-brand" href="/">{profile.nome || 'Portfólio'}</a><div>{navigation.map(page=><a key={page.id} href={page.slug === 'inicio' ? '/' : `/${page.slug}`} aria-current={page.id === activePage.id ? 'page' : undefined}>{page.title}</a>)}</div></nav>
    {(activePage.sections || []).map(section=><Section key={section.id} section={section} data={data} preview={preview}/>)}
    <footer className="composer-footer"><span>{profile.nome || 'Portfólio'}</span><a href="#topo">Voltar ao início ↑</a></footer>
  </main>
}
