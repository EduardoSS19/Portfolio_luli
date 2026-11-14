import { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react'
import { FundoFantasma } from './components/FundoFantasma.jsx'
import { Hero } from './components/Hero.jsx'
import { Nav } from './components/Nav.jsx'
import { Sobre } from './components/Sobre.jsx'
import { SecaoCategoria } from './components/SecaoCategoria.jsx'
import { GaleriaGrade } from './components/GaleriaGrade.jsx'
import { GaleriaGradeDiagnostico } from './components/GaleriaGradeDiagnostico.jsx'
import { Referencias } from './components/Referencias.jsx'
import { Footer } from './components/Footer.jsx'
import { useSecaoAtiva } from './hooks/useSecaoAtiva.js'
import { Contato } from './components/Contato.jsx'
import { trackAnalyticsEvent } from './utils/analytics.js'
import { CmsPage } from './cms/CmsPage.jsx'

const DEFAULT_LAYOUT_SETTINGS = {
  content_width: 'standard',
  hero_alignment: 'center',
  hero_size: 'large',
  section_spacing: 'comfortable',
  gallery_columns: '3',
  default_gallery_view: 'lista',
  presentation_mode: 'editorial',
  navigation_mode: 'curtain',
  default_theme: 'escuro',
  dark_color_background: '#061522',
  dark_color_surface: '#0b2943',
  dark_color_text: '#eff7ff',
  dark_color_muted: '#a9bdcc',
  dark_color_accent: '#93c8f2',
  light_color_background: '#f5f2eb',
  light_color_surface: '#ffffff',
  light_color_text: '#24231f',
  light_color_muted: '#77746c',
  light_color_accent: '#657c62',
  show_bio_image: true,
  show_bio: true,
  show_references: true,
  show_contact: true,
  custom_sections: [],
}

const LAYOUT_PREVIEW_CHOICES = {
  content_width: ['compact', 'standard', 'wide'],
  hero_alignment: ['center', 'left'],
  hero_size: ['compact', 'large'],
  section_spacing: ['compact', 'comfortable', 'spacious'],
  gallery_columns: ['2', '3', '4'],
  default_gallery_view: ['lista', 'grade'],
  presentation_mode: ['editorial', 'carousel', 'immersive', 'masonry'],
  navigation_mode: ['curtain', 'dropdown', 'sidebar'],
  default_theme: ['escuro', 'claro'],
}
const LAYOUT_PREVIEW_COLORS = ['dark_color_background','dark_color_surface','dark_color_text','dark_color_muted','dark_color_accent','light_color_background','light_color_surface','light_color_text','light_color_muted','light_color_accent']

function parseLayoutPreview(raw) {
  try {
    const candidate = JSON.parse(raw)
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null
    const safe = {}
    Object.entries(LAYOUT_PREVIEW_CHOICES).forEach(([key, choices]) => {
      if (choices.includes(candidate[key])) safe[key] = candidate[key]
    })
    LAYOUT_PREVIEW_COLORS.forEach(key => {
      if (typeof candidate[key] === 'string' && /^#[0-9a-fA-F]{6}$/.test(candidate[key])) safe[key] = candidate[key].toLowerCase()
    })
    if (Array.isArray(candidate.custom_sections)) safe.custom_sections = candidate.custom_sections.filter(section => section && typeof section.id === 'string' && typeof section.title === 'string' && Array.isArray(section.items)).slice(0, 10)
    ;['show_bio_image','show_bio','show_references','show_contact'].forEach(key => {
      if (typeof candidate[key] === 'boolean') safe[key] = candidate[key]
    })
    return safe
  } catch {
    return null
  }
}

function colorLuminance(hex){
  const channels=hex.replace('#','').match(/.{2}/g).map(value=>parseInt(value,16)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4)
  return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722
}
function colorContrast(a,b){
  const values=[colorLuminance(a),colorLuminance(b)].sort((x,y)=>y-x)
  return(values[0]+.05)/(values[1]+.05)
}
function blendColor(from,to,amount){
  const a=from.match(/[0-9a-f]{2}/gi).map(value=>parseInt(value,16))
  const b=to.match(/[0-9a-f]{2}/gi).map(value=>parseInt(value,16))
  return '#'+a.map((value,index)=>Math.round(value+(b[index]-value)*amount).toString(16).padStart(2,'0')).join('')
}
function accessibleColor(foreground,background,minimum=4.5){
  if(!foreground||!background||colorContrast(foreground,background)>=minimum)return foreground
  const target=colorContrast('#000000',background)>=colorContrast('#ffffff',background)?'#000000':'#ffffff'
  let low=0,high=1
  for(let step=0;step<22;step++){
    const middle=(low+high)/2
    if(colorContrast(blendColor(foreground,target,middle),background)>=minimum)high=middle
    else low=middle
  }
  return blendColor(foreground,target,high)
}


const LAYOUT_PREVIEW_DEMO = {
  categorias: [
    { titulo: 'Pintura e experimentação', chave: 'pintura-experimentacao', animacao: 'obra', obras: [
      { titulo: 'Estudo de luz I', imagem: 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=1400&q=85', descricao: 'Camadas de cor e gestos sobrepostos investigam a luz como matéria.', detalhe: 'Acrílica, pigmento e textura constroem uma paisagem entre abstração e memória.', fichaTecnica: { tecnica: 'Acrílica sobre tela', material: 'Tinta acrílica e tela', ano: '2025', dimensoes: { altura: '60', largura: '80', unidade: 'cm' } } },
      { titulo: 'Matéria em suspensão', imagem: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=1400&q=85', descricao: 'Uma pesquisa visual sobre cor, espaço e memória.', detalhe: 'A série reúne estudos feitos no ateliê ao longo de um processo de experimentação.' },
    ]},
    { titulo: 'Fotografia', chave: 'fotografia', animacao: 'fotografia', obras: [
      { titulo: 'Entre espaços', imagem: 'https://images.unsplash.com/photo-1519608487953-e999c86e7455?w=1400&q=85', descricao: 'Uma pesquisa visual sobre cor, espaço e memória. Integer nec odio.', detalhe: 'Imagens produzidas em caminhadas por espaços urbanos e paisagens de transição.' },
      { titulo: 'Paisagem inventada', imagem: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=1400&q=85', descricao: 'Fotografias de paisagem e observações de campo.' },
    ]},
    { titulo: 'Desenho e gravura', chave: 'desenho-gravura', animacao: 'gravura', obras: [
      { titulo: 'Linhas de memória', imagem: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=1400&q=85', descricao: 'Desenhos em tinta e grafite exploram linhas, ritmo e pequenas narrativas.', detalhe: 'Série de gravuras experimentais impressas em papel de algodão.' },
      { titulo: 'Pequenas narrativas', imagem: 'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=1400&q=85', descricao: 'Caderno de estudos, matrizes e impressões em pequena escala.' },
    ]},
  ],
  referencias: [
    { titulo: 'Exposição coletiva — Espaços possíveis', periodo: '2025 · Porto Alegre, Brasil', links: [{ texto: 'Descrição da exposição', url: '#referencia-teste-1' }, { texto: 'Registro fotográfico', url: '#referencia-teste-2' }] },
    { titulo: 'Residência artística — Laboratório de processos', periodo: '2024 · Projeto fictício para testes', links: [{ texto: 'Sobre o projeto', url: '#referencia-teste-3' }] },
    { titulo: 'Publicação — Caderno de experimentações', periodo: '2023 · Edição demonstrativa', links: [{ texto: 'Consultar publicação', url: '#referencia-teste-4' }] },
  ],
  sobre: { nome: 'Artista de demonstração', frase: 'Arte · Pesquisa · Experimentação', foto: 'https://images.unsplash.com/photo-1531058020387-3be344556be6?w=900&q=85', bio: 'Artista visual que pesquisa as relações entre matéria, memória e paisagem. Seu trabalho combina pintura, fotografia e processos gráficos para criar narrativas sobre os lugares que habitamos.\n\nEntre o ateliê e a cidade, desenvolve séries autorais, projetos colaborativos e experiências educativas. Cada trabalho nasce de experimentações com cor, textura e diferentes escalas.', instagram: 'https://www.instagram.com/exemplo.artista', email: 'contato@artista-demo.example', formulario: 'https://example.com/contato' },
  frames: [],
  redes: [{ titulo: 'Instagram de demonstração', url: '#rede-teste' }],
}


function getLayoutPreviewDemo(layout = {}) {
  const sections = layout.custom_sections || []
  const sectionTypes = sections.map(section => section.type)
  const preset = ['editorial-current','visual-artist','illustrator','photographer','designer','tattoo-artist','tattoo-studio']
    .find(id => sections.some(section => String(section.id).includes('preset-' + id + '-')))
  const isTattoo = preset === 'tattoo-artist' || sectionTypes.includes('tattoo-flash') || sectionTypes.includes('tattoo-booking') || sectionTypes.includes('healed-work')
  const isStudio = preset === 'tattoo-studio' || sectionTypes.includes('studio-team')
  const isPhoto = preset === 'photographer' || (!preset && layout.presentation_mode === 'immersive')
  const isDesign = preset === 'designer' || (!preset && layout.presentation_mode === 'carousel' && layout.default_theme === 'claro')
  const isIllustration = preset === 'illustrator' || (!preset && layout.presentation_mode === 'masonry' && layout.default_theme === 'claro')

  const profiles = {
    editorial: {
      nome: 'Helena Duarte', frase: 'Artes visuais · Pintura · Pesquisa material',
      foto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1000&q=90',
      bio: 'Artista visual e pesquisadora independente. Investiga as relações entre matéria, memória e paisagem por meio da pintura, da fotografia e de processos gráficos.\n\nSeu trabalho nasce de observações cotidianas e experimentações no ateliê, aproximando gesto, cor e território.',
      instagram: 'https://www.instagram.com/', email: 'contato@helenaduarte.art',
    },
    visual: {
      nome: 'Marina Azevedo', frase: 'Artista visual · Pintura · Escultura',
      foto: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=1000&q=90',
      bio: 'Artista visual que trabalha entre pintura, objeto e instalação. Sua pesquisa explora a memória dos materiais, as marcas do tempo e as relações entre corpo e espaço.\n\nParticipa de exposições individuais e coletivas, desenvolve projetos site-specific e conduz oficinas de experimentação.',
      instagram: 'https://www.instagram.com/', email: 'studio@marinaazevedo.art',
    },
    illustration: {
      nome: 'Bia Campos', frase: 'Ilustração · Desenho · Narrativas visuais',
      foto: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=1000&q=90',
      bio: 'Ilustradora e desenhista. Cria imagens para livros, revistas, projetos culturais e marcas, combinando desenho manual, cor e composição digital.\n\nSeu universo visual reúne personagens, botânica e pequenas narrativas do cotidiano.',
      instagram: 'https://www.instagram.com/', email: 'oi@biacampos.illustration',
    },
    photo: {
      nome: 'Clara Nogueira', frase: 'Fotografia · Retrato · Arquitetura',
      foto: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=1000&q=90',
      bio: 'Fotógrafa independente especializada em retratos, arquitetura e projetos editoriais. Trabalha com luz natural e narrativas visuais que valorizam gestos, texturas e atmosferas.\n\nAtende projetos autorais, editoriais e ensaios comissionados.',
      instagram: 'https://www.instagram.com/', email: 'contato@claranogueira.photo',
    },
    design: {
      nome: 'Estúdio Norte', frase: 'Design estratégico · Branding · Direção de arte',
      foto: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=1000&q=90',
      bio: 'Estúdio independente de design e direção de arte. Conecta estratégia, identidade e experiências digitais para construir marcas com linguagem própria.\n\nAtua em branding, design editorial, interfaces, campanhas e sistemas visuais.',
      instagram: 'https://www.instagram.com/', email: 'hello@estudionorte.design',
    },
    tattoo: {
      nome: 'Maya Reis', frase: 'Tatuagem autoral · Fine line · Botânica',
      foto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1000&q=90',
      bio: 'Tatuadora e ilustradora. Desenvolve desenhos autorais inspirados em botânica, símbolos e narrativas pessoais. Cada projeto é pensado para o corpo e construído em diálogo com quem vai receber a tatuagem.\n\nAtendimentos com hora marcada e projetos personalizados.',
      instagram: 'https://www.instagram.com/', email: 'agenda@mayareis.tattoo',
    },
    studio: {
      nome: 'Casa Tinta Tattoo', frase: 'Estúdio independente · Porto Alegre · Brasil',
      foto: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=1000&q=90',
      bio: 'Um estúdio independente dedicado à tatuagem autoral, ao desenho e à troca entre artistas. Reunimos diferentes especialidades em um espaço acolhedor, com atenção ao processo criativo, à biossegurança e ao cuidado em cada sessão.',
      instagram: 'https://www.instagram.com/', email: 'agenda@casatinta.studio',
    },
  }

  const artwork = {
    editorial: [
      { titulo:'Cartografia do silêncio', imagem:'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=1600&q=90', imagens:['https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=1600&q=90','https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=1600&q=90','https://images.unsplash.com/photo-1577083552431-6e5fd01aa342?w=1600&q=90'], descricao:'Camadas de pigmento e gestos sobrepostos constroem uma paisagem entre lembrança e invenção.', detalhe:'Série Cartografias · Obra demonstrativa', fichaTecnica:{tecnica:'Acrílica e pigmento mineral',material:'Tela de algodão e madeira',ano:'2025',dimensoes:{altura:'100',largura:'80',unidade:'cm'},serie:'Cartografias',disponibilidade:'Sob consulta'} },
      { titulo:'Matéria em suspensão', imagem:'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=1600&q=90', descricao:'Uma investigação sobre transparência, densidade e a presença física da cor.', detalhe:'Trabalho de ateliê · 2025', fichaTecnica:{tecnica:'Técnica mista',material:'Acrílica, grafite e tecido',ano:'2025',dimensoes:{altura:'70',largura:'50',unidade:'cm'}} },
      { titulo:'O peso das coisas leves', imagem:'https://images.unsplash.com/photo-1577083552431-6e5fd01aa342?w=1600&q=90', descricao:'Pequenas formas e áreas de respiro criam um equilíbrio instável entre matéria e vazio.', detalhe:'Série Objetos de memória · 2024', fichaTecnica:{tecnica:'Óleo sobre tela',material:'Tela e pigmentos',ano:'2024',dimensoes:{altura:'90',largura:'70',unidade:'cm'}} },
      { titulo:'Inventário de gestos', imagem:'https://images.unsplash.com/photo-1549490349-8643362247b5?w=1600&q=90', descricao:'Estudos cromáticos reunidos a partir de movimentos repetidos no ateliê.', detalhe:'Caderno de pesquisa · 2024' },
    ],
    visual: [
      { titulo:'Corpo-território I', imagem:'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=1600&q=90', imagens:['https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=1600&q=90','https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=1600&q=90'], descricao:'Pintura em grande escala sobre pertencimento, corpo e paisagem.', detalhe:'Série Corpo-território · 2025', fichaTecnica:{tecnica:'Óleo e cera',material:'Linho sobre chassi',ano:'2025',dimensoes:{altura:'180',largura:'140',unidade:'cm'}} },
      { titulo:'Arquivo das águas', imagem:'https://images.unsplash.com/photo-1549490349-8643362247b5?w=1600&q=90', descricao:'Instalação composta por módulos cerâmicos e registros de paisagem.', detalhe:'Instalação · 2024', fichaTecnica:{tecnica:'Instalação',material:'Cerâmica, argila e som',ano:'2024'} },
      { titulo:'Entre paredes', imagem:'https://images.unsplash.com/photo-1577083552431-6e5fd01aa342?w=1600&q=90', descricao:'Pintura mural desenvolvida a partir da arquitetura do espaço expositivo.', detalhe:'Projeto site-specific · 2024' },
      { titulo:'Pequeno atlas', imagem:'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=1600&q=90', descricao:'Objetos e desenhos que registram percursos e memórias de viagem.', detalhe:'Série de estudos · 2023' },
    ],
    illustration: [
      { titulo:'O jardim depois da chuva', imagem:'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=1600&q=90', imagens:['https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=1600&q=90','https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=1600&q=90','https://images.unsplash.com/photo-1455390582262-044cdead277a?w=1600&q=90'], descricao:'Ilustração editorial sobre crescimento, transformação e pequenos encontros.', detalhe:'Editorial · 2025', fichaTecnica:{tecnica:'Guache e finalização digital',material:'Papel algodão',ano:'2025',serie:'Pequenas histórias'} },
      { titulo:'Manual de criaturas gentis', imagem:'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=1600&q=90', descricao:'Personagens e cenários para um livro ilustrado infantil.', detalhe:'Livro ilustrado · Projeto autoral · 2025' },
      { titulo:'Botânica imaginária', imagem:'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=1600&q=90', descricao:'Estudos de formas vegetais, padrões e cores.', detalhe:'Série de prints · 2024' },
      { titulo:'Caderno de campo', imagem:'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=1600&q=90', descricao:'Desenhos, anotações e estudos de composição.', detalhe:'Sketchbook · 2024' },
    ],
    photo: [
      { titulo:'A cidade em suspensão', imagem:'https://images.unsplash.com/photo-1519608487953-e999c86e7455?w=1800&q=90', imagens:['https://images.unsplash.com/photo-1519608487953-e999c86e7455?w=1800&q=90','https://images.unsplash.com/photo-1518005020951-eccb494ad742?w=1800&q=90','https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=1800&q=90'], descricao:'Uma leitura da arquitetura urbana no intervalo entre luz e sombra.', detalhe:'Ensaio autoral · 2025', fichaTecnica:{tecnica:'Fotografia digital',material:'Impressão fine art',ano:'2025',serie:'Cidade em suspensão'} },
      { titulo:'Entre marés', imagem:'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?w=1800&q=90', descricao:'Paisagens costeiras observadas como espaços de passagem e permanência.', detalhe:'Série documental · 2024' },
      { titulo:'Presença', imagem:'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1800&q=90', descricao:'Retratos com luz natural e direção intimista.', detalhe:'Retrato editorial · 2025' },
      { titulo:'Linhas de concreto', imagem:'https://images.unsplash.com/photo-1511818966892-d7d671e672a2?w=1800&q=90', descricao:'Geometrias e texturas de edifícios em transformação.', detalhe:'Arquitetura · 2024' },
    ],
    design: [
      { titulo:'Casa Orla · Identidade visual', imagem:'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1600&q=90', imagens:['https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1600&q=90','https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1600&q=90'], descricao:'Estratégia, identidade e aplicações para uma marca de hospitalidade conectada à paisagem.', detalhe:'Branding completo · 2025', fichaTecnica:{tecnica:'Estratégia de marca e direção de arte',material:'Identidade visual e aplicações',ano:'2025'} },
      { titulo:'Ponto de Encontro · Editorial', imagem:'https://images.unsplash.com/photo-1544816155-12df9643f363?w=1600&q=90', descricao:'Sistema editorial para uma iniciativa cultural, da linguagem gráfica à publicação impressa.', detalhe:'Design editorial · 2024' },
      { titulo:'Forma Viva · Embalagem', imagem:'https://images.unsplash.com/photo-1558655146-d09347e92766?w=1600&q=90', descricao:'Sistema de embalagem e comunicação para uma linha de produtos botânicos.', detalhe:'Design de produto · 2024' },
      { titulo:'Norte Digital · Experiência', imagem:'https://images.unsplash.com/photo-1559028012-481c04fa702d?w=1600&q=90', descricao:'Arquitetura de informação e interface para uma plataforma cultural.', detalhe:'Produto digital · 2025' },
    ],
    tattoo: [
      { titulo:'Ramo de oliveira', imagem:'https://images.unsplash.com/photo-1598371839696-5c5bb00bdc28?w=1600&q=90', imagens:['https://images.unsplash.com/photo-1598371839696-5c5bb00bdc28?w=1600&q=90','https://images.unsplash.com/photo-1565058379802-bbe93b2f703a?w=1600&q=90'], descricao:'Composição botânica em fine line, desenhada para acompanhar o movimento do antebraço.', detalhe:'Projeto autoral · Fine line · 8 cm', fichaTecnica:{tecnica:'Fine line',material:'Tinta preta',ano:'2026',localCriacao:'Porto Alegre',disponibilidade:'Projeto demonstrativo'} },
      { titulo:'Eclipse ornamental', imagem:'https://images.unsplash.com/photo-1565058379802-bbe93b2f703a?w=1600&q=90', descricao:'Geometria, simetria e contraste em uma composição ornamental.', detalhe:'Blackwork · 12 cm · Projeto autoral' },
      { titulo:'Serpente e flores', imagem:'https://images.unsplash.com/photo-1611501275019-9b5cda994e8d?w=1600&q=90', descricao:'Desenho orgânico que mistura elementos botânicos e movimento.', detalhe:'Blackwork · Panturrilha' },
      { titulo:'Pequeno amuleto', imagem:'https://images.unsplash.com/photo-1590246814883-57c511e1e5d1?w=1600&q=90', descricao:'Flash delicado pensado para aplicação em pequena escala.', detalhe:'Flash · 6 cm · Disponível' },
    ],
    studio: [
      { titulo:'Projeto coletivo · Botânica', imagem:'https://images.unsplash.com/photo-1598371839696-5c5bb00bdc28?w=1600&q=90', descricao:'Trabalho desenvolvido por artista residente da Casa Tinta.', detalhe:'Fine line · 2026' },
      { titulo:'Ornamental em movimento', imagem:'https://images.unsplash.com/photo-1565058379802-bbe93b2f703a?w=1600&q=90', descricao:'Composição ornamental criada em sessão de projeto personalizado.', detalhe:'Ornamental · 2025' },
      { titulo:'Blackwork · Forma e contraste', imagem:'https://images.unsplash.com/photo-1611501275019-9b5cda994e8d?w=1600&q=90', descricao:'Estudo de grandes áreas e desenho gráfico.', detalhe:'Blackwork · 2025' },
      { titulo:'Natureza simbólica', imagem:'https://images.unsplash.com/photo-1590246814883-57c511e1e5d1?w=1600&q=90', descricao:'Flash autoral inspirado em formas orgânicas.', detalhe:'Flash · 2025' },
    ],
  }

  const references = {
    editorial: [
      { titulo:'Exposição individual · Cartografias do silêncio', periodo:'2025 · Galeria Horizonte, Porto Alegre', links:[{texto:'Apresentação da exposição',url:'#demo-exposicao'},{texto:'Registro fotográfico',url:'#demo-registro'}] },
      { titulo:'Residência artística · Casa Aberta', periodo:'2024 · Florianópolis, Brasil', links:[{texto:'Sobre a residência',url:'#demo-residencia'}] },
      { titulo:'Publicação · Caderno de matéria', periodo:'2023 · Edição independente', links:[{texto:'Consultar publicação',url:'#demo-publicacao'}] },
    ],
    visual: [
      { titulo:'Exposição · Corpo-território', periodo:'2025 · Museu de Arte Contemporânea', links:[{texto:'Ver exposição',url:'#demo-exposicao'}] },
      { titulo:'Residência · Laboratório de matéria', periodo:'2024 · São Paulo, Brasil', links:[{texto:'Projeto e pesquisa',url:'#demo-residencia'}] },
      { titulo:'Prêmio aquisição · Salão de Artes', periodo:'2023 · Edição demonstrativa', links:[{texto:'Conhecer seleção',url:'#demo-premio'}] },
    ],
    illustration: [
      { titulo:'Livro ilustrado · O jardim depois da chuva', periodo:'2025 · Editora Pétala', links:[{texto:'Ver publicação',url:'#demo-livro'}] },
      { titulo:'Editorial · Revista Miolo', periodo:'2024 · Edição 18', links:[{texto:'Ler matéria',url:'#demo-revista'}] },
      { titulo:'Seleção · Feira de ilustração', periodo:'2023 · Porto Alegre, Brasil', links:[{texto:'Ver participantes',url:'#demo-feira'}] },
    ],
    photo: [
      { titulo:'Exposição · A cidade em suspensão', periodo:'2025 · Centro Cultural', links:[{texto:'Ver ensaio',url:'#demo-ensaio'}] },
      { titulo:'Editorial · Revista Vértice', periodo:'2024 · Edição 42', links:[{texto:'Ler publicação',url:'#demo-editorial'}] },
    ],
    design: [
      { titulo:'Prêmio · Brasil Design Award', periodo:'2025 · Projeto demonstrativo', links:[{texto:'Ver case premiado',url:'#demo-premio'}] },
      { titulo:'Publicação · Latin American Design', periodo:'2024 · Seleção editorial', links:[{texto:'Ver publicação',url:'#demo-publicacao'}] },
      { titulo:'Palestra · Design em processo', periodo:'2023 · Semana de Design', links:[{texto:'Programação',url:'#demo-palestra'}] },
    ],
    tattoo: [
      { titulo:'Convenção · Tattoo Week', periodo:'2025 · São Paulo, Brasil', links:[{texto:'Artistas participantes',url:'#demo-convencao'}] },
      { titulo:'Guest spot · Estúdio Norte', periodo:'2024 · Curitiba, Brasil', links:[{texto:'Agenda demonstrativa',url:'#demo-guest'}] },
    ],
    studio: [
      { titulo:'Convenção · Tattoo Week', periodo:'2025 · São Paulo, Brasil', links:[{texto:'Artistas participantes',url:'#demo-convencao'}] },
      { titulo:'Matéria · Cultura da tatuagem', periodo:'2024 · Revista Traço', links:[{texto:'Ler matéria',url:'#demo-materia'}] },
    ],
  }

  const variant = isStudio ? 'studio' : isTattoo ? 'tattoo' : isPhoto ? 'photo' : isDesign ? 'design' : isIllustration ? 'illustration' : preset === 'visual-artist' ? 'visual' : 'editorial'
  const profile = profiles[variant]
  const works = artwork[variant]
  const categoryNames = {
    editorial:['Pintura e experimentação','Fotografia e paisagem','Desenho e gravura'],
    visual:['Pintura e matéria','Escultura e instalação','Intervenções e projetos'],
    illustration:['Ilustração editorial','Personagens e narrativas','Desenho e sketchbook'],
    photo:['Ensaios autorais','Retratos e editoriais','Arquitetura e espaço'],
    design:['Identidade e branding','Design editorial','Digital e experiências'],
    tattoo:['Tatuagens autorais','Projetos personalizados','Detalhes e estudos'],
    studio:['Trabalhos do estúdio','Artistas residentes','Flash coletivo'],
  }[variant]
  const categories = categoryNames.map((title,index) => ({
    titulo:title,
    chave:title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),
    animacao:variant === 'photo' ? 'fotografia' : variant === 'illustration' ? 'desenho' : variant === 'tattoo' || variant === 'studio' ? 'obra' : index === 1 ? 'gravura' : 'obra',
    obras: works.slice(index === 0 ? 0 : index === 1 ? 1 : 2, index === 0 ? 3 : index === 1 ? 4 : 4),
  }))
  if (variant === 'tattoo') {
    categories[1].obras = [
      { titulo:'Flash botânico 08', imagem:'https://images.unsplash.com/photo-1590246814883-57c511e1e5d1?w=1600&q=90', descricao:'Desenho autoral disponível para reserva.', detalhe:'8 cm · Fine line · Disponível', fichaTecnica:{tecnica:'Fine line',disponibilidade:'Disponível'} },
      { titulo:'Amuleto solar 03', imagem:'https://images.unsplash.com/photo-1562962230-16e4623d36e6?w=1600&q=90', descricao:'Composição ornamental exclusiva, adaptável em escala.', detalhe:'10 cm · Ornamental · Disponível', fichaTecnica:{tecnica:'Ornamental',disponibilidade:'Disponível'} },
      { titulo:'Pequena serpente', imagem:'https://images.unsplash.com/photo-1611501275019-9b5cda994e8d?w=1600&q=90', descricao:'Flash botânico com desenho fluido.', detalhe:'7 cm · Blackwork · Disponível' },
    ]
    categories[2].obras = [
      { titulo:'Botânica cicatrizada · 6 meses', imagem:'https://images.unsplash.com/photo-1611501275019-9b5cda994e8d?w=1600&q=90', descricao:'Registro demonstrativo após cicatrização completa.', detalhe:'Acompanhamento · 6 meses' },
      { titulo:'Ornamental cicatrizada · 1 ano', imagem:'https://images.unsplash.com/photo-1598371839696-5c5bb00bdc28?w=1600&q=90', descricao:'Evolução do contraste e da definição após um ano.', detalhe:'Acompanhamento · 12 meses' },
    ]
  }
  if (variant === 'studio') {
    categories[1].obras = [
      { titulo:'Ana Reis · Fine line e botânica', imagem:'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1000&q=85', descricao:'Traços delicados, composições botânicas e desenhos autorais.', detalhe:'Artista residente · Agenda aberta' },
      { titulo:'Caio Nunes · Blackwork', imagem:'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=1000&q=85', descricao:'Contraste, formas gráficas e composições de grande escala.', detalhe:'Artista residente · Agenda aberta' },
      { titulo:'Lia Monteiro · Ornamental', imagem:'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=1000&q=85', descricao:'Simetria, geometria e desenhos ornamentais.', detalhe:'Artista convidada · Agenda sob consulta' },
    ]
  }
  const extraSections = {
    exhibitions: [
      {title:'Cartografias afetivas',period:'2025 · Galeria Horizonte',description:'Exposição coletiva sobre memória, território e paisagem.',image:'https://images.unsplash.com/photo-1577083552431-6e5fd01aa342?w=1000&q=85',url:'#demo-exposicao'},
      {title:'Matéria em trânsito',period:'2024 · Espaço independente',description:'Participação em mostra dedicada a processos e experimentações.',image:'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=1000&q=85',url:'#demo-mostra'},
    ],
    process: [
      {title:'Caderno de ateliê',period:'Processo · 2025',description:'Estudos, testes de materiais e composições que antecedem uma série.',image:'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=1000&q=85'},
      {title:'Da ideia à matéria',period:'Processo · 2024',description:'Registro das etapas de pesquisa, experimentação e finalização.',image:'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=1000&q=85'},
    ],
    services: [
      {title:'Projeto sob encomenda',period:'Briefing e orçamento',description:'Criação personalizada com pesquisa visual, estudos e acompanhamento das etapas.',image:'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=1000&q=85'},
      {title:'Oficinas e encontros',period:'Individual ou em grupo',description:'Experiências práticas e encontros de experimentação em diferentes linguagens.',image:'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=1000&q=85'},
    ],
    press: [
      {title:'Conversas sobre processo',period:'Revista Traço · 2025',description:'Entrevista sobre pesquisa, prática profissional e circulação de trabalhos.',url:'#demo-entrevista'},
      {title:'Novas linguagens visuais',period:'Caderno de Arte · 2024',description:'Publicação sobre artistas e práticas contemporâneas.',url:'#demo-publicacao'},
    ],
    testimonials: [
      {title:'Marina Costa · Curadora',period:'Exposição Cartografias',description:'“Uma pesquisa sensível, consistente e aberta ao diálogo com diferentes públicos.”'},
      {title:'João Martins · Cliente',period:'Projeto comissionado',description:'“O processo foi colaborativo do início ao fim, com cuidado em cada detalhe.”'},
    ],
    'tattoo-flash': [
      {title:'Ramo botânico 08',period:'Flash disponível · 8 cm',description:'Fine line em preto. Aplicação sugerida no antebraço ou panturrilha.',image:'https://images.unsplash.com/photo-1598371839696-5c5bb00bdc28?w=1000&q=85'},
      {title:'Eclipse ornamental',period:'Flash disponível · 10 cm',description:'Composição ornamental em preto, adaptável mediante consulta.',image:'https://images.unsplash.com/photo-1565058379802-bbe93b2f703a?w=1000&q=85'},
      {title:'Pequena serpente',period:'Flash disponível · 7 cm',description:'Desenho autoral de linhas fluidas e formas orgânicas.',image:'https://images.unsplash.com/photo-1611501275019-9b5cda994e8d?w=1000&q=85'},
    ],
    'tattoo-booking': [
      {title:'Como solicitar um orçamento',period:'Agenda aberta · 2026',description:'Envie sua ideia, referências, região do corpo e tamanho aproximado. Retornaremos com disponibilidade e estimativa.'},
      {title:'Preparação para a sessão',period:'Antes da tatuagem',description:'Após a confirmação, você recebe orientações de preparo, cuidados e reserva da data.'},
    ],
    'healed-work': [
      {title:'Botânica cicatrizada',period:'Registro após 6 meses',description:'Resultado demonstrativo após cicatrização completa, com textura e contraste preservados.',image:'https://images.unsplash.com/photo-1611501275019-9b5cda994e8d?w=1000&q=85'},
      {title:'Composição ornamental',period:'Registro após 1 ano',description:'Acompanhamento da evolução do trabalho na pele.',image:'https://images.unsplash.com/photo-1590246814883-57c511e1e5d1?w=1000&q=85'},
    ],
    'guest-spots': [
      {title:'São Paulo · Estúdio Horizonte',period:'12–16 de março de 2027',description:'Agenda especial para projetos autorais e consultas presenciais.'},
      {title:'Curitiba · Casa Tinta',period:'02–05 de abril de 2027',description:'Vagas limitadas para flash e projetos previamente aprovados.'},
    ],
    'studio-team': [
      {title:'Ana Reis · Fine line e botânica',period:'Artista residente',description:'Pesquisa traços delicados, composições botânicas e desenhos autorais.',image:'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1000&q=85'},
      {title:'Caio Nunes · Blackwork',period:'Artista residente',description:'Trabalha com contraste, formas gráficas e composições de grande escala.',image:'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=1000&q=85'},
      {title:'Lia Monteiro · Ornamental',period:'Artista convidada',description:'Explora simetria, geometria e ornamentos inspirados em arquitetura.',image:'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=1000&q=85'},
    ],
  }
  const social = variant === 'studio'
    ? [{titulo:'Instagram',url:'https://www.instagram.com/'},{titulo:'Agendamentos',url:'mailto:agenda@casatinta.studio'},{titulo:'Localização',url:'https://maps.google.com/?q=Porto+Alegre'}]
    : [{titulo:'Instagram',url:profile.instagram},{titulo:'Behance',url:'https://www.behance.net/'},{titulo:'E-mail',url:'mailto:'+profile.email}]
  return {
    categorias: categories,
    referencias: references[variant],
    frames: [],
    redes: social,
    sobre: {...profile, formulario:'#demo-contato'},
    sectionExamples: extraSections,
    marca: '',
  }
}

const perfilInicial = {
  nome: 'Nome da artista',
  frase: 'Arte · Pesquisa · Experimentação',
  foto: '',
  bio: 'Uma pesquisa visual sobre cor, espaço e memória.',
  instagram: '',
  email: '',
  formulario: '',
}

const PREVIEW_SECTION_EXAMPLES = {
  exhibitions: [
    { title: 'Cartografias afetivas', period: '2025 · Galeria Municipal', description: 'Exposição coletiva sobre memória, território e paisagem. Porto Alegre, Brasil.', image: 'https://images.unsplash.com/photo-1577083552431-6e5fd01aa342?w=1000&q=85', url: '#exposicao-demo' },
    { title: 'Matéria em trânsito', period: '2024 · Espaço independente', description: 'Participação em mostra dedicada a processos e experimentações contemporâneas.', image: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=1000&q=85', url: '#mostra-demo' },
  ],
  process: [
    { title: 'Estudos de cor e composição', period: 'Caderno de ateliê · 2025', description: 'Testes de pigmentos, transparências e sobreposições que antecedem a série principal.', image: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=1000&q=85' },
    { title: 'Da matriz à impressão', period: 'Processo · 2024', description: 'Registro das etapas de preparação, gravação e impressão manual.', image: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=1000&q=85' },
  ],
  services: [
    { title: 'Projeto sob encomenda', period: 'Sob consulta', description: 'Criação de obras e imagens personalizadas, com briefing, estudo visual e acompanhamento das etapas.', image: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=1000&q=85' },
    { title: 'Oficinas e encontros', period: 'Individual ou em grupo', description: 'Experiências práticas de desenho, pintura e experimentação de materiais.', image: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=1000&q=85' },
  ],
  press: [
    { title: 'Conversas sobre processo', period: 'Revista Traço · 2025', description: 'Entrevista sobre pesquisa artística, prática de ateliê e circulação de trabalhos.', url: '#entrevista-demo' },
    { title: 'Novas materialidades', period: 'Caderno de Arte · 2024', description: 'Publicação que reúne artistas que investigam matéria e tecnologia.', url: '#publicacao-demo' },
  ],
  testimonials: [
    { title: 'Marina Costa · Curadora', period: 'Projeto Cartografias', description: '“Uma pesquisa sensível, consistente e aberta ao diálogo com diferentes públicos.”' },
    { title: 'João Martins · Cliente', period: 'Projeto autoral', description: '“O processo foi colaborativo do início ao fim, com cuidado em cada detalhe.”' },
  ],
  'tattoo-flash': [
    { title: 'Botânica — ramo de oliveira', period: 'Flash disponível · 8 cm', description: 'Fine line em preto. Aplicação sugerida no antebraço ou panturrilha. Peça única.', image: 'https://images.unsplash.com/photo-1598371839696-5c5bb00bdc28?w=1000&q=85' },
    { title: 'Ornamental — eclipse', period: 'Flash disponível · 10 cm', description: 'Composição ornamental em preto, com adaptação de tamanho mediante consulta.', image: 'https://images.unsplash.com/photo-1565058379802-bbe93b2f703a?w=1000&q=85' },
  ],
  'tattoo-booking': [
    { title: 'Como solicitar um orçamento', period: 'Agendamentos abertos', description: 'Envie a ideia, referências visuais, região do corpo e tamanho aproximado. Retornaremos com disponibilidade e estimativa.' },
    { title: 'Preparação para a sessão', period: 'Antes da tatuagem', description: 'Após a confirmação, você recebe orientações de preparo, cuidados e sinal para reserva da data.' },
  ],
  'healed-work': [
    { title: 'Botânica cicatrizada', period: 'Registro após 6 meses', description: 'Resultado após cicatrização completa, com textura e contraste preservados.', image: 'https://images.unsplash.com/photo-1611501275019-9b5cda994e8d?w=1000&q=85' },
    { title: 'Composição ornamental', period: 'Registro após 1 ano', description: 'Acompanhamento da evolução do trabalho na pele.', image: 'https://images.unsplash.com/photo-1590246814883-57c511e1e5d1?w=1000&q=85' },
  ],
  'guest-spots': [
    { title: 'São Paulo · Casa Tinta', period: '12–16 de março de 2027', description: 'Agenda especial para projetos autorais e consultas presenciais.' },
    { title: 'Curitiba · Estúdio Norte', period: '02–05 de abril de 2027', description: 'Vagas limitadas para flash e projetos previamente aprovados.' },
  ],
  'studio-team': [
    { title: 'Ana Reis · Fine line e botânica', period: 'Artista residente', description: 'Pesquisa traços delicados, composições botânicas e desenhos autorais.', image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&q=85' },
    { title: 'Caio Nunes · Blackwork', period: 'Artista residente', description: 'Trabalha com contraste, formas gráficas e composições de grande escala.', image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&q=85' },
  ],
}

function PortfolioCustomSections({ sections = [], preview = false, examples = null }) {
  const metaFields = {
    exhibitions:['venue','location','format'],process:['stage','technique','materials'],services:['format','price','duration'],
    press:['publication','author','period'],testimonials:['author','role','project'],'tattoo-flash':['size','placement','price','status'],
    'tattoo-booking':['step','channel','response_time','policy'],'healed-work':['placement','healing_time','period'],
    'guest-spots':['city','studio','dates'],'studio-team':['role','specialties','instagram'],
  }
  const labels = {venue:'Espaço',location:'Local',format:'Formato',stage:'Etapa',technique:'Técnica',materials:'Materiais',price:'Investimento',duration:'Prazo',publication:'Publicação',author:'Autoria',role:'Função',project:'Projeto',size:'Tamanho',placement:'Local',status:'Disponibilidade',step:'Etapa',channel:'Contato',response_time:'Retorno',policy:'Orientação',healing_time:'Cicatrização',city:'Cidade',studio:'Estúdio',dates:'Datas',specialties:'Especialidades',instagram:'Instagram',period:'Período'}
  return sections.filter(section => section && section.title && Array.isArray(section.items) && (section.items.length || preview)).map(section => {
    const items = section.items.length ? section.items : (preview ? examples?.[section.type] || PREVIEW_SECTION_EXAMPLES[section.type] || [] : [])
    const design = section.design || {}
    const defaultLayouts = {exhibitions:'timeline',process:'steps',services:'cards',press:'list',testimonials:'quotes','tattoo-flash':'flash-grid','tattoo-booking':'steps','healed-work':'gallery','guest-spots':'agenda','studio-team':'team-grid'}
    const layout = design.layout || defaultLayouts[section.type] || 'cards'
    return (
      <section className={'secao portfolio-custom-section section-'+section.type+' section-layout-'+layout+' section-density-'+(design.density||'comfortable')} id={section.id} key={section.id} data-columns={design.columns||'2'} data-image-ratio={design.image_ratio||'landscape'} data-preview-example={preview && !section.items.length ? 'true' : undefined}>
        <header className="secao-cabecalho visivel"><span className="secao-indice">{preview ? 'EXEMPLO DE CONTEÚDO' : 'PORTFÓLIO'}</span><h2>{section.title}</h2><span className="secao-contagem">{String(items.length).padStart(2,'0')} itens</span></header>
        {section.intro && <p className="portfolio-custom-intro">{section.intro}</p>}
        <div className="portfolio-custom-grid">
          {items.map((item,index)=>{
            const meta=(metaFields[section.type]||['period']).filter(key=>item[key])
            const content=(
              <>
                {layout==='before-after'&&<div className="portfolio-custom-before-after">
                  {item.image_before&&<figure><img src={item.image_before} alt={item.title+' — antes'} loading="lazy"/><figcaption>Antes</figcaption></figure>}
                  {item.image_after&&<figure><img src={item.image_after} alt={item.title+' — cicatrizado'} loading="lazy"/><figcaption>Depois</figcaption></figure>}
                </div>}
                {item.image&&<img src={item.image} alt={item.title||''} loading="lazy"/>}
                <div><h3>{item.title}</h3>
                  {meta.map(key=><small className={'portfolio-custom-meta meta-'+key} key={key}><strong>{labels[key]||key}:</strong> {item[key]}</small>)}
                  {item.description&&<p>{item.description}</p>}
                  {(item.url||item.booking_url)&&<a href={item.url||item.booking_url} target="_blank" rel="noreferrer">{section.type==='tattoo-booking'?'Solicitar agendamento':section.type==='services'?'Consultar serviço':'Saiba mais'} ↗</a>}
                </div>
              </>
            )
            return layout==='accordion'
              ? <details className="portfolio-custom-card portfolio-custom-accordion" key={section.id+'-'+index}><summary><strong>{item.title||'Detalhes'}</strong><span>{meta[0]?item[meta[0]]:''}</span></summary><div className="portfolio-custom-accordion-content">{content}</div></details>
              : <article className="portfolio-custom-card" key={section.id+'-'+index}>{content}</article>
          })}
        </div>
      </section>
    )
  })
}

export default function App() {
  const [conteudo, setConteudo] = useState({
    categorias: [],
    referencias: [],
    frames: [],
    redes: [],
    sobre: null,
    marca: '',
    layout: DEFAULT_LAYOUT_SETTINGS,
  })
  const [carregando, setCarregando] = useState(true)
  const [previsualizacao, setPrevisualizacao] = useState(null)
  const categorias = conteudo.categorias
  const referencias = conteudo.referencias
  const sobre = conteudo.sobre ?? perfilInicial
  const [modoGaleria, setModoGaleria] = useState(DEFAULT_LAYOUT_SETTINGS.default_gallery_view)
  // O portfólio sempre inicia no tema escuro; a escolha clara vale apenas para a sessão atual.
  const [tema, setTema] = useState(DEFAULT_LAYOUT_SETTINGS.default_theme)

  useEffect(() => {
    document.documentElement.dataset.theme = tema
    document.documentElement.style.colorScheme = tema === 'claro' ? 'light' : 'dark'
  }, [tema])

  useEffect(() => {
    const layout = { ...DEFAULT_LAYOUT_SETTINGS, ...(conteudo.layout || {}) }
    const prefix = tema === 'claro' ? 'light' : 'dark'
    const background = layout[`${prefix}_color_background`]
    document.documentElement.style.setProperty('--layout-page-background', background)
    document.body.style.background = 'var(--layout-page-background)'
  }, [conteudo.layout, tema])
  const secoesNav = useMemo(() => [
    ...(conteudo.layout?.show_bio_image !== false || conteudo.layout?.show_bio !== false ? [{ titulo: 'Início', chave: 'inicio' }] : []),
    ...categorias.map(c => ({ titulo: c.titulo, chave: c.chave })),
    ...(referencias.length && (conteudo.layout?.show_references ?? true) ? [{ titulo: 'Referências', chave: 'referencias' }] : []),
    ...(conteudo.layout?.custom_sections || []).filter(section => section.title && (section.items?.length || new URLSearchParams(window.location.search).has('layout_preview'))).map(section => ({ titulo: section.title, chave: section.id })),
    ...(conteudo.layout?.show_contact !== false ? [{ titulo: 'Contato', chave: 'contato' }] : []),
  ], [categorias, referencias.length, conteudo.layout?.show_references, conteudo.layout?.show_bio_image, conteudo.layout?.show_bio, conteudo.layout?.show_contact, conteudo.layout?.custom_sections])
  const [secaoAtiva, definirSecaoAtiva] = useSecaoAtiva(secoesNav, modoGaleria)
  const [animando, setAnimando] = useState(null)
  const [mostrarVoltarTopo, setMostrarVoltarTopo] = useState(false)
  const animacaoPendenteRef = useRef(null)
  const animacaoTimerRef = useRef(null)
  const trocaModoPendenteRef = useRef(null)
  const selecaoCategoriaTimerRef = useRef(null)
  const scrollEndHandlerRef = useRef(null)

  function trocarModoGaleria(novoModo) {
    if (novoModo === modoGaleria) return
    trackAnalyticsEvent('gallery_view_change', { view_mode: novoModo })
    const cards = [...document.querySelectorAll('.galeria-grade-global .obra, .secao .obra')]
    const centro = window.innerHeight / 2
    const cardAtual = cards
      .map(card => ({ card, rect: card.getBoundingClientRect() }))
      .filter(({ rect }) => rect.bottom > 0 && rect.top < window.innerHeight)
      .sort((a, b) => Math.abs((a.rect.top + a.rect.height / 2) - centro) - Math.abs((b.rect.top + b.rect.height / 2) - centro))[0]
    trocaModoPendenteRef.current = cardAtual?.card.dataset.obraChave
      ? { chave: cardAtual.card.dataset.obraChave, topo: cardAtual.rect.top }
      : null
    setModoGaleria(novoModo)
  }

  useLayoutEffect(() => {
    const pendente = trocaModoPendenteRef.current
    if (!pendente) return
    const card = [...document.querySelectorAll('.galeria-grade-global .obra, .secao .obra')]
      .find(item => item.dataset.obraChave === pendente.chave)
    if (card) {
      const novoTopo = card.getBoundingClientRect().top
      window.scrollBy({ top: novoTopo - pendente.topo, behavior: 'auto' })
    }
    trocaModoPendenteRef.current = null
  }, [modoGaleria])

  useEffect(() => {
    if (carregando || !new URLSearchParams(window.location.search).has('layout_preview')) return undefined
    const handleLayoutPreviewUpdate = event => {
      if (event.origin !== window.location.origin || event.source !== window.parent || event.data?.type !== 'cms-layout-preview:update') return
      const safeSettings = parseLayoutPreview(JSON.stringify(event.data.settings || {}))
      if (!safeSettings) return
      const previewRoute = new URLSearchParams(window.location.search).has('layout_preview')
      setConteudo(current => {
        const nextLayout = { ...current.layout, ...safeSettings }
        const demo = previewRoute ? getLayoutPreviewDemo(nextLayout) : null
        return { ...current, ...(demo ? { categorias: demo.categorias, referencias: demo.referencias, frames: demo.frames, redes: demo.redes, sobre: demo.sobre, previewSectionExamples: demo.sectionExamples, marca: demo.marca } : {}), layout: nextLayout }
      })
      const previewMode = ['lista', 'grade'].includes(event.data.previewMode) ? event.data.previewMode : safeSettings.default_gallery_view
      if (previewMode) setModoGaleria(previewMode)
      if (safeSettings.default_theme) setTema(safeSettings.default_theme)
      window.dispatchEvent(new CustomEvent('cms-layout-preview:navigation', {
        detail: { open: false, mode: safeSettings.navigation_mode || 'curtain' },
      }))

      // A navegação acontece somente no documento da prévia (iframe).
      // Nunca envia foco/scroll para a página externa do CMS.
      // Somente o hover contextual pode navegar dentro do iframe.
      // Atualizações disparadas por clique/aplicação atualizam o visual sem scroll.
      if (event.data.animatePreview !== true) return

      const focus = event.data.focus
      const selector = focus === 'hero' ? '.hero'
        : focus === 'gallery'
          ? (previewMode === 'grade' ? '.galeria-grade-global' : '.secao:not(.sobre-secao):not(.secao-contato)')
          : focus === 'bio' ? '.sobre-secao'
            : focus === 'references' ? '#Referências'
              : focus === 'contact' ? '#Contato'
                : null
      if (selector) {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            document.querySelector(selector)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
          })
        })
      }
    }
    window.addEventListener('message', handleLayoutPreviewUpdate)
    window.parent.postMessage({ type: 'cms-layout-preview:ready' }, window.location.origin)
    return () => window.removeEventListener('message', handleLayoutPreviewUpdate)
  }, [carregando])

  const initialLayoutPreviewFocusHandledRef = useRef(false)
  useEffect(() => {
    if (!carregando && !initialLayoutPreviewFocusHandledRef.current && new URLSearchParams(window.location.search).has('layout_preview')) {
      initialLayoutPreviewFocusHandledRef.current = true
      const focus = new URLSearchParams(window.location.search).get('layout_preview_focus')
      const selector = focus === 'hero' ? '.hero' : focus === 'gallery'
        ? (modoGaleria === 'grade' ? '.galeria-grade-global' : '.secao:not(.sobre-secao)')
        : null
      if (selector) {
        window.requestAnimationFrame(() => {
          document.querySelector(selector)?.scrollIntoView({ block: 'start', behavior: 'instant' })
        })
      }
    }
  }, [carregando, modoGaleria])

  useEffect(() => {
    function atualizarBotaoTopo() {
      setMostrarVoltarTopo(window.scrollY > 560)
    }

    atualizarBotaoTopo()
    window.addEventListener('scroll', atualizarBotaoTopo, { passive: true })
    return () => window.removeEventListener('scroll', atualizarBotaoTopo)
  }, [])

  useEffect(() => {
    if (window.location.pathname === '/painel' || window.location.pathname === '/painel/') {
      setCarregando(false)
      return undefined
    }

    const controller = new AbortController()

    const params = new URLSearchParams(window.location.search)
    const layoutPreview = params.has('layout_preview') ? parseLayoutPreview(params.get('layout_preview')) : null
    const previewToken = params.get('preview_token')
    const categoryPreviewToken = params.get('category_preview_token')
    const apiUrl = previewToken
      ? `/api/portfolio/?preview_token=${encodeURIComponent(previewToken)}`
      : categoryPreviewToken
        ? `/api/portfolio/?category_preview_token=${encodeURIComponent(categoryPreviewToken)}`
        : '/api/portfolio/'

    fetch(apiUrl, { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error(`API respondeu ${response.status}`)
        return response.json()
      })
      .then(data => {
        const previewSettings = { ...DEFAULT_LAYOUT_SETTINGS, ...(data.layout || {}), ...(layoutPreview || {}) }
        const demoContent = params.has('layout_preview') && !params.has('layout_preview_live') ? getLayoutPreviewDemo(previewSettings) : null
        setConteudo(atual => ({
          categorias: demoContent ? demoContent.categorias : Array.isArray(data.categorias) ? data.categorias : [],
          referencias: demoContent ? demoContent.referencias : Array.isArray(data.referencias) ? data.referencias : [],
          frames: demoContent ? demoContent.frames : Array.isArray(data.frames) ? data.frames : [],
          redes: demoContent ? demoContent.redes : Array.isArray(data.redes) ? data.redes : [],
          previewSectionExamples: demoContent ? demoContent.sectionExamples : null,
          sobre: demoContent ? demoContent.sobre : data.sobre && typeof data.sobre.bio === 'string' ? data.sobre : null,
          marca: demoContent ? '' : data.marca || '',
          layout: { ...DEFAULT_LAYOUT_SETTINGS, ...(data.layout || {}), ...(layoutPreview || {}) },
        }))
        const layout = { ...DEFAULT_LAYOUT_SETTINGS, ...(data.layout || {}), ...(layoutPreview || {}) }
        setModoGaleria(layout.default_gallery_view)
        setTema(layout.default_theme)
        setPrevisualizacao(params.has('layout_preview') ? null : data.preview ?? null)
      })
      .catch(error => {
        if (error.name !== 'AbortError') {
          console.warn('Não foi possível carregar o conteúdo do Django.', error)
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setCarregando(false)
      })

    return () => controller.abort()
  }, [])

  function dispararAnimacaoCategoria(chave) {
    if (animacaoTimerRef.current) window.clearTimeout(animacaoTimerRef.current)
    setAnimando(chave)
    animacaoTimerRef.current = window.setTimeout(() => {
      setAnimando(atual => atual === chave ? null : atual)
      animacaoTimerRef.current = null
    }, 850)
  }

  // A seção ativa também muda durante a rolagem manual. Só animamos o título
  // quando a navegação foi solicitada explicitamente pelo menu e chegou ao destino.
  useEffect(() => {
    const pendente = animacaoPendenteRef.current
    if (!pendente || secaoAtiva !== pendente.titulo) return
    animacaoPendenteRef.current = null
    dispararAnimacaoCategoria(pendente.chave)
  }, [secaoAtiva])

  function selecionarCategoria(titulo) {
    // Cancela confirmações de navegações anteriores. Sem isso, cliques rápidos
    // podem deixar timeouts/scrollend antigos sobrescrevendo a categoria atual.
    if (selecaoCategoriaTimerRef.current) {
      window.clearTimeout(selecaoCategoriaTimerRef.current)
      selecaoCategoriaTimerRef.current = null
    }
    if (scrollEndHandlerRef.current) {
      window.removeEventListener('scrollend', scrollEndHandlerRef.current)
      scrollEndHandlerRef.current = null
    }

    // A seleção explícita deve refletir imediatamente na navegação.
    const categoriaAnimacao = secoesNav.find(secao => secao.titulo === titulo)
    if (categoriaAnimacao) {
      if (secaoAtiva === titulo) {
        animacaoPendenteRef.current = null
        dispararAnimacaoCategoria(categoriaAnimacao.chave)
      } else {
        animacaoPendenteRef.current = categoriaAnimacao
      }
    }
    definirSecaoAtiva(titulo)
    const comportamentoRolagem = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    const rolarPara = (elemento, alinhamento = 'start') => {
      const retangulo = elemento.getBoundingClientRect()
      const margem = alinhamento === 'center'
        ? (window.innerHeight - retangulo.height) / 2
        : 24
      window.scrollTo({
        top: Math.max(0, window.scrollY + retangulo.top - margem),
        behavior: comportamentoRolagem,
      })
    }
    const secao = document.getElementById(titulo) || (categoriaAnimacao?.chave ? document.getElementById(categoriaAnimacao.chave) : null)
    if (secao) {
      rolarPara(secao)
      return
    }
    const categoria = categorias.find(item => item.titulo === titulo)
    const primeiraObra = categoria && [...document.querySelectorAll('.galeria-grade-global .obra')]
      .find(card => card.classList.contains(`categoria-${categoria.chave}`))
    if (primeiraObra) {
      // A rolagem suave dispara atualizações do observer enquanto ainda está
      // chegando ao destino. Reafirma a seleção quando a rolagem terminar,
      // para que a navegação não volte temporariamente à categoria anterior.
      const confirmarDestino = () => {
        if (selecaoCategoriaTimerRef.current) {
          window.clearTimeout(selecaoCategoriaTimerRef.current)
          selecaoCategoriaTimerRef.current = null
        }
        if (scrollEndHandlerRef.current === confirmarDestino) {
          scrollEndHandlerRef.current = null
        }
        definirSecaoAtiva(titulo)
      }
      scrollEndHandlerRef.current = confirmarDestino
      window.addEventListener('scrollend', confirmarDestino, { once: true })
      rolarPara(primeiraObra, 'center')
      selecaoCategoriaTimerRef.current = window.setTimeout(() => {
        window.removeEventListener('scrollend', confirmarDestino)
        confirmarDestino()
      }, 2000)
    }
  }

  function voltarAoTopo() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      window.scrollTo(0, 0)
      return
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (window.location.pathname === '/painel' || window.location.pathname === '/painel/') {
    return <CmsPage />
  }

  if (carregando) {
    return (
      <div className="carregando" role="status" aria-live="polite">
        <span className="carregando-anel" aria-hidden="true" />
        <span className="carregando-texto">Carregando</span>
      </div>
    )
  }

  const modoDiagnosticoGrade = new URLSearchParams(window.location.search).get('grade-debug') === '1'
  const layout = conteudo.layout || DEFAULT_LAYOUT_SETTINGS
  const isLayoutPreview = new URLSearchParams(window.location.search).has('layout_preview')
  const isCompactLayoutPreview = new URLSearchParams(window.location.search).get('layout_preview_compact') === '1'
  const palettePrefix = tema === 'claro' ? 'light' : 'dark'
  const effectiveColors = {
    color_background: layout[`${palettePrefix}_color_background`],
    color_surface: layout[`${palettePrefix}_color_surface`],
    color_text: layout[`${palettePrefix}_color_text`],
    color_muted: layout[`${palettePrefix}_color_muted`],
    color_accent: layout[`${palettePrefix}_color_accent`],
  }
  const readableText = accessibleColor(effectiveColors.color_text, effectiveColors.color_background)
  const readableSurfaceText = accessibleColor(effectiveColors.color_text, effectiveColors.color_surface)
  const readableMuted = accessibleColor(effectiveColors.color_muted, effectiveColors.color_background)
  const readableSurfaceMuted = accessibleColor(effectiveColors.color_muted, effectiveColors.color_surface)
  const readableAccent = accessibleColor(effectiveColors.color_accent, effectiveColors.color_background)
  const readableAccentOnSurface = accessibleColor(effectiveColors.color_accent, effectiveColors.color_surface)
  const readableAccentOnOverlay = accessibleColor(effectiveColors.color_accent, '#051421')
  const readableNavMuted = accessibleColor(effectiveColors.color_muted, effectiveColors.color_surface)
  const readableTextOnAccent = accessibleColor(readableText, readableAccent)
  const layoutColors = {
    '--azul-escuro': effectiveColors.color_background,
    '--azul-medio': effectiveColors.color_surface,
    '--azul-claro': readableAccent,
    '--texto': readableText,
    '--linha': effectiveColors.color_muted + '44',
    '--layout-muted': readableMuted,
    '--layout-surface-text': readableSurfaceText,
    '--layout-surface-muted': readableSurfaceMuted,
    '--layout-text-on-accent': readableTextOnAccent,
    '--layout-accent-on-surface': readableAccentOnSurface,
    '--layout-accent-on-overlay': readableAccentOnOverlay,
    '--layout-nav-muted': readableNavMuted,
    '--layout-grid-title': '#ffffff',
    '--layout-grid-description': '#ffffff',
    '--rodape-fundo': effectiveColors.color_background,
    '--rodape-texto': readableText,
    '--rodape-muted': readableMuted,
  }
  const layoutAttributes = {
    style: { ...layoutColors, background: effectiveColors.color_background, color: readableText },
    'data-layout-preview': isLayoutPreview ? 'true' : undefined,
    'data-layout-width': layout.content_width,
    'data-layout-hero-align': layout.hero_alignment,
    'data-layout-hero-size': layout.hero_size,
    'data-layout-spacing': layout.section_spacing,
    'data-layout-gallery-columns': layout.gallery_columns,
    'data-layout-presentation': layout.presentation_mode || 'editorial',
    'data-layout-navigation': layout.navigation_mode || 'curtain',
    'data-layout-show-bio-image': String(layout.show_bio_image !== false),
    'data-layout-show-bio': String(layout.show_bio !== false),
    'data-layout-show-references': String(layout.show_references !== false),
  }

  if (modoDiagnosticoGrade) {
    return <GaleriaGradeDiagnostico categorias={categorias} />
  }

  if (previsualizacao && !previsualizacao.category) {
    const categoriaPreview = categorias[0]
    const obraPreview = categoriaPreview?.obras?.[0]
    return (
      <main className="site-shell preview-only-shell" {...layoutAttributes}>
        <FundoFantasma frames={conteudo.frames} />
        <header className="preview-only-header">
          <div>
            <span>PRÉVIA PRIVADA · LINK TEMPORÁRIO</span>
            <h1>{previsualizacao.titulo}</h1>
            <p>Visualização isolada da obra no design do portfólio. Nada aqui altera a publicação.</p>
          </div>
          <a href="/" aria-label="Sair da prévia e voltar ao portfólio">Sair da prévia ↗</a>
        </header>
        {categoriaPreview && obraPreview ? (
          <SecaoCategoria
            titulo={categoriaPreview.titulo}
            chave={categoriaPreview.chave}
            animacao={categoriaPreview.animacao}
            obras={[obraPreview]}
            indice={0}
          />
        ) : (
          <p className="preview-only-empty">Não foi possível carregar esta obra. Gere uma nova prévia pelo painel.</p>
        )}
      </main>
    )
  }

  if (previsualizacao?.category) {
    const categoria = categorias[0]
    return (
      <main className="site-shell preview-only-shell" {...layoutAttributes}>
        <FundoFantasma frames={conteudo.frames} />
        <header className="preview-only-header">
          <div><span>PRÉVIA DE ORGANIZAÇÃO · LINK TEMPORÁRIO</span><h1>{categoria?.titulo || previsualizacao.titulo}</h1><p>Somente esta categoria e sua nova ordem são exibidas. Nada foi publicado.</p></div>
          <a href="/" aria-label="Sair da prévia e voltar ao portfólio">Sair da prévia ↗</a>
        </header>
        {categoria ? <SecaoCategoria titulo={categoria.titulo} chave={categoria.chave} animacao={categoria.animacao} obras={categoria.obras} indice={0} /> : <p className="preview-only-empty">Não foi possível carregar esta categoria. Gere outra prévia pelo painel.</p>}
      </main>
    )
  }

  return (
    <div className="site-shell" {...layoutAttributes}>
      {isLayoutPreview && !isCompactLayoutPreview && <div className="layout-preview-banner" role="status">PRÉVIA DE LAYOUT · alterações ainda não salvas</div>}
      {previsualizacao && !previsualizacao.category && (
        <div className="preview-mode-banner" role="status">
          Prévia privada · {previsualizacao.titulo} · somente você pode visualizar este rascunho
        </div>
      )}
      <FundoFantasma frames={conteudo.frames} />
      <Hero nome={sobre.nome} frase={sobre.frase} />
      <Nav
        categorias={secoesNav}
        categoriaAtiva={secaoAtiva}
        animando={animando}
        aoSelecionar={selecionarCategoria}
        modoGaleria={modoGaleria}
        aoTrocarModo={trocarModoGaleria}
        tema={tema}
        aoTrocarTema={() => setTema(atual => atual === 'escuro' ? 'claro' : 'escuro')}
        navigationMode={layout.navigation_mode || 'curtain'}
        nomeArtista={sobre.nome}
        fraseArtista={sobre.frase}
      />
      {(layout.show_bio_image !== false || layout.show_bio !== false) && <Sobre perfil={sobre} mostrarImagem={layout.show_bio_image !== false} mostrarBio={layout.show_bio !== false} />}
      {modoGaleria === 'grade' ? (
        <GaleriaGrade categorias={categorias} />
      ) : (
        categorias.map((cat, indice) => (
          <SecaoCategoria
            key={cat.titulo}
            titulo={cat.titulo}
            chave={cat.chave}
            animacao={cat.animacao}
            obras={cat.obras}
            indice={indice}
            animando={animando === cat.chave}
          />
        ))
      )}
      {layout.show_references !== false && referencias.length > 0 && <Referencias referencias={referencias} />}
      <PortfolioCustomSections sections={layout.custom_sections || []} preview={isLayoutPreview} examples={conteudo.previewSectionExamples} />
      {isLayoutPreview && layout.show_references === false && <div id="Referências" className="layout-preview-hidden-anchor" aria-hidden="true" hidden style={{display:'none'}} />}
      {layout.show_contact !== false && <Contato endpoint={sobre.formulario} email={sobre.email} demoMode={isLayoutPreview} />}
      <Footer nome={sobre.nome} instagram={sobre.instagram} email={sobre.email} redes={conteudo.redes} />
      <div className="controles-flutuantes" role="group" aria-label="Controles de visualização">
        <button
          type="button"
          className={`voltar-topo ${mostrarVoltarTopo ? 'visivel' : ''}`}
          aria-label="Voltar ao topo"
          onClick={voltarAoTopo}
          tabIndex={mostrarVoltarTopo ? 0 : -1}
          aria-hidden={!mostrarVoltarTopo}
        >
          <span aria-hidden="true">↑</span>
        </button>
        <button
          type="button"
          className="alternar-modo-flutuante"
          aria-label={modoGaleria === 'lista' ? 'Alternar para visualização em grade' : 'Alternar para visualização em lista'}
          title={modoGaleria === 'lista' ? 'Ver em grade' : 'Ver em lista'}
          onClick={() => trocarModoGaleria(modoGaleria === 'lista' ? 'grade' : 'lista')}
        >
          <span aria-hidden="true">{modoGaleria === 'lista' ? '▦' : '☷'}</span>
          <span>{modoGaleria === 'lista' ? 'Grade' : 'Lista'}</span>
        </button>
      </div>
    </div>
  )
}