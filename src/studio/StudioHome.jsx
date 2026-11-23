import React from 'react'
import './StudioHome.css'

const experiences = [
  { id: 'editorial', number: '01', name: 'Editorial', kind: 'Narrativa', description: 'Uma composição tipográfica e arejada, feita para trabalhos que pedem contexto, ritmo e leitura.', tags: ['Tipografia', 'Respiro', 'Texto + imagem'], shape: 'editorial' },
  { id: 'immersive', number: '02', name: 'Imersivo', kind: 'Atmosfera', description: 'Imagem, escala e presença conduzem a experiência. Para projetos em que o universo visual fala primeiro.', tags: ['Imagem', 'Atmosfera', 'Impacto'], shape: 'immersive' },
  { id: 'masonry', number: '03', name: 'Mosaico', kind: 'Composição', description: 'Um campo visual dinâmico para coleções, séries e portfólios com obras de formatos diferentes.', tags: ['Grade variável', 'Coleções', 'Ritmo'], shape: 'masonry' },
  { id: 'timeline', number: '04', name: 'Linha do tempo', kind: 'Percurso', description: 'Processos, projetos e trajetórias organizados como uma história que se desenrola.', tags: ['Sequência', 'Processo', 'Contexto'], shape: 'timeline' },
  { id: 'brutalist', number: '05', name: 'Brutalista', kind: 'Expressão', description: 'Contraste, tipografia incisiva e estrutura assumida. Uma presença digital sem neutralidade.', tags: ['Contraste', 'Tipografia', 'Atitude'], shape: 'brutalist' },
  { id: 'cinematic', number: '06', name: 'Cinemático', kind: 'Movimento', description: 'Uma apresentação guiada por imagens, pausas e transições para projetos que pedem sequência.', tags: ['Sequência', 'Movimento', 'Imersão'], shape: 'cinematic' },
  { id: 'museum', number: '07', name: 'Museu', kind: 'Acervo', description: 'Uma organização cuidadosa para obras, séries, informações e referências que merecem permanência.', tags: ['Acervo', 'Detalhes', 'Curadoria'], shape: 'museum' },
  { id: 'tattoo-book', number: '08', name: 'Caderno de flashes', kind: 'Especializado', description: 'Uma linguagem dedicada a tatuadores: desenhos, disponibilidade, informações e contato.', tags: ['Flashes', 'Disponibilidade', 'Agenda'], shape: 'tattoo' },
]

const modules = [
  ['Abertura', 'Identidade e primeira impressão'],
  ['Sobre', 'Biografia, trajetória e contexto'],
  ['Galeria', 'Séries, categorias e trabalhos'],
  ['Obra em destaque', 'Uma peça como protagonista'],
  ['Texto editorial', 'Manifestos, processos e narrativas'],
  ['Imagem', 'Pausas e composições visuais'],
  ['Referências', 'Exposições, publicações e formação'],
  ['Flash de tatuagem', 'Coleções, valores e disponibilidade'],
  ['Contato', 'Canais e conversas'],
]

function ModelArtwork({ shape }) {
  return <div className={'studio-model-art studio-model-art-' + shape} aria-hidden="true">
    <span className="art-block art-block-one" /><span className="art-block art-block-two" /><span className="art-block art-block-three" />
    <span className="art-line" /><span className="art-caption">COMPOSIÇÃO / 0{experiences.findIndex(item => item.shape === shape) + 1}</span>
  </div>
}

export function StudioHome() {
  return <main className="studio-home">
    <header className="studio-nav">
      <a className="studio-wordmark" href="/studio" aria-label="Estúdio, início"><span className="studio-mark">◎</span> ESTÚDIO<span className="studio-wordmark-dot">.</span></a>
      <nav aria-label="Navegação do estúdio">
        <a href="#modelos">Modelos</a><a href="#ideia">Nossa ideia</a><a href="#construcao">Como construímos</a><a className="studio-nav-cta" href="mailto:leduardoss19@gmail.com">Vamos conversar ↗</a>
      </nav>
    </header>

    <section className="studio-hero" id="topo">
      <div className="studio-hero-meta"><span>TECNOLOGIA / EXPRESSÃO / AUTONOMIA</span><span>UM ESTÚDIO EM CONSTRUÇÃO CONTÍNUA</span></div>
      <p className="studio-kicker">UM LUGAR PARA IDEIAS GANHAREM FORMA</p>
      <h1>O digital não deveria <em>limitar</em> aquilo que você é.</h1>
      <div className="studio-hero-bottom"><p>Construímos experiências digitais modulares para pessoas, artistas e projetos que precisam de uma presença tão singular quanto o que fazem.</p><a href="#modelos">Explore as possibilidades <span>↓</span></a></div>
      <div className="studio-hero-graphic" aria-hidden="true"><div className="studio-orbit orbit-a"/><div className="studio-orbit orbit-b"/><div className="studio-orbit orbit-c"/><span>FORMA<br/>LIVRE</span></div>
      <div className="studio-hero-index"><span>01 — 04</span><span>ESTRUTURA FLEXÍVEL, IDENTIDADE PRÓPRIA</span></div>
    </section>

    <section className="studio-intro" id="ideia">
      <p className="studio-section-label">01 / O QUE NOS MOVE</p>
      <div><h2>Não fazemos pessoas caberem em templates. <em>Criamos estruturas que se adaptam a elas.</em></h2><p>Acreditamos que cada trabalho tem uma linguagem. Uma artista não organiza seu universo como um fotógrafo; um estúdio não conta sua história como uma ilustradora. A tecnologia deve ampliar essas diferenças — não apagá-las.</p></div>
    </section>

    <section className="studio-models" id="modelos">
      <div className="studio-section-heading"><div><p className="studio-section-label">02 / A CASA DOS MODELOS</p><h2>Uma estrutura.<br/><em>Muitas possibilidades.</em></h2></div><p>Estes são alguns caminhos de composição disponíveis na arquitetura do CMS. Não são temas fechados: são pontos de partida que podem ser combinados, reorganizados e transformados.</p></div>
      <div className="studio-model-grid">{experiences.map(item => <article className="studio-model-card" key={item.id}>
        <ModelArtwork shape={item.shape}/>
        <div className="studio-model-info"><div className="studio-model-overline"><span>{item.number} / {item.kind}</span><span>EXPERIÊNCIA</span></div><h3>{item.name}</h3><p>{item.description}</p><div className="studio-tags">{item.tags.map(tag => <span key={tag}>{tag}</span>)}</div></div>
      </article>)}</div>
      <p className="studio-model-note">O catálogo é uma amostra da linguagem do sistema. A próxima etapa é conectá-lo ao cadastro de modelos do CMS, para que novas experiências publicadas no painel apareçam aqui sem alterações no código.</p>
    </section>

    <section className="studio-principles" id="construcao">
      <p className="studio-section-label">03 / COMO PENSAMOS</p>
      <div className="studio-principles-heading"><h2>Liberdade criativa precisa de uma boa <em>estrutura.</em></h2><p>Por trás de uma experiência simples de usar existe um sistema que precisa ser consistente, seguro e preparado para crescer.</p></div>
      <div className="studio-principle-list">
        <article><span>01</span><div><h3>Autonomia real</h3><p>O conteúdo pertence a quem cria. Atualizar uma obra, reorganizar uma página ou publicar uma novidade não deveria exigir uma intervenção técnica.</p></div></article>
        <article><span>02</span><div><h3>Composição modular</h3><p>Páginas são feitas de partes que podem mudar de lugar, ganhar novas funções e formar experiências diferentes sem começar do zero.</p></div></article>
        <article><span>03</span><div><h3>Tecnologia responsável</h3><p>Desempenho, acessibilidade, responsividade e segurança fazem parte do projeto desde a fundação — não são acabamento.</p></div></article>
        <article><span>04</span><div><h3>Evolução sem aprisionamento</h3><p>Um sistema bom permite experimentar hoje e crescer amanhã, sem transformar cada nova ideia em uma reforma completa.</p></div></article>
      </div>
    </section>

    <section className="studio-modularity">
      <div className="studio-modularity-copy"><p className="studio-section-label">04 / POR DENTRO DO SISTEMA</p><h2>Peças independentes.<br/><em>Experiências inteiras.</em></h2><p>O CMS combina estruturas de página, sessões, navegação e identidade visual. Cada camada tem uma responsabilidade — e pode ser ajustada sem desmontar as outras.</p></div>
      <div className="studio-module-stack">{modules.map(([name,description],index)=><div className="studio-module-row" key={name}><span>{String(index+1).padStart(2,'0')}</span><strong>{name}</strong><small>{description}</small><span className="studio-module-plus">＋</span></div>)}</div>
    </section>

    <section className="studio-founder">
      <p className="studio-section-label">05 / QUEM CONSTRÓI</p>
      <div><p className="studio-founder-mark">EDUARDO SOUZA <span>— DESENVOLVIMENTO &amp; PESQUISA</span></p><h2>Entre código, imagem e intenção, existe um espaço para construir <em>de outro jeito.</em></h2><p>Este projeto nasce do encontro entre desenvolvimento de software, curiosidade visual e a vontade de criar ferramentas que respeitem quem está do outro lado da tela. Não queremos apenas entregar sites. Queremos construir um sistema que dê às pessoas mais controle sobre como seu trabalho é visto, entendido e lembrado.</p></div>
    </section>

    <footer className="studio-footer"><div><p className="studio-section-label">06 / CONTINUAMOS CONSTRUINDO</p><h2>Uma boa ideia merece<br/><em>um espaço próprio.</em></h2><a href="mailto:leduardoss19@gmail.com">Conte o que você imagina <span>↗</span></a></div><div className="studio-footer-bottom"><a className="studio-wordmark" href="#topo"><span className="studio-mark">◎</span> ESTÚDIO<span className="studio-wordmark-dot">.</span></a><span>TECNOLOGIA A SERVIÇO DA EXPRESSÃO.</span><a href="/">Voltar ao portfólio ↗</a></div></footer>
  </main>
}
