// Troque esses dados pelas obras reais dela. "chave" é o identificador
// técnico usado pra escolher a animação (não precisa ser bonito).
// "titulo" é o que aparece na tela.
export const categorias = [
  {
    titulo: 'Cerâmica',
    chave: 'ceramica',
    obras: [
      { titulo: 'Vaso Terra', icone: '🏺', descricao: 'Peça em argila, queima alta.', detalhe: 'Técnica: torno + esmalte à base de cinza vegetal.' },
      { titulo: 'Tigela Azul', icone: '🏺', descricao: 'Esmalte reativo, torno manual.', detalhe: 'Cozida em forno a lenha, 1280°C.' },
    ],
  },
  {
    titulo: 'Glitch Art',
    chave: 'glitch',
    obras: [
      { titulo: 'Ruído 01', icone: '📺', descricao: 'Distorção digital, RGB split.', detalhe: 'Databending feito em editor hexadecimal.' },
      { titulo: 'Fragmentado', icone: '📺', descricao: 'Databending sobre foto analógica.', detalhe: 'Fotografia original de 2019, reprocessada.' },
    ],
  },
  {
    titulo: 'Gravura',
    chave: 'escultura',
    obras: [
      { titulo: 'Forma Suspensa', icone: '🗿', descricao: 'Argila e arame, 40cm.', detalhe: 'Estrutura interna em arame galvanizado.' },
      { titulo: 'Torção', icone: '🗿', descricao: 'Peça em gesso patinado.', detalhe: 'Patina feita com pigmento óxido.' },
    ],
  },
  {
    titulo: 'Desenho',
    chave: 'desenho',
    obras: [
      { titulo: 'Retrato a Grafite', icone: '✏️', descricao: 'Grafite sobre papel, A3.', detalhe: 'Grafite 2B a 8B, aproximadamente 12h de trabalho.' },
      { titulo: 'Estudo de Mãos', icone: '✏️', descricao: 'Nanquim, traço contínuo.', detalhe: 'Feito sem levantar a caneta do papel.' },
    ],
  },
]
