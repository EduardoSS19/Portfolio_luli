# Portfólio — projeto Vite + React

## Como rodar

```bash
npm install
npm run dev
```

Abre em `http://localhost:5173`. Qualquer alteração salva atualiza a página sozinha (hot reload).

## Como gerar a versão de produção

```bash
npm run build
```

Isso gera uma pasta `dist/` com os arquivos finais, prontos pra subir em qualquer hospedagem estática (Netlify, Vercel, GitHub Pages).

## Estrutura

```
portfolio-vite/
├── index.html
├── package.json
├── vite.config.js
└── src/
    ├── main.jsx              # ponto de entrada
    ├── App.jsx                # orquestra os componentes
    ├── components/
    │   ├── Hero.jsx
    │   ├── Nav.jsx
    │   ├── ObraCard.jsx
    │   └── SecaoCategoria.jsx
    ├── hooks/
    │   └── useScrollReveal.js # Intersection Observer encapsulado
    ├── data/
    │   └── obras.js           # troque pelos dados reais das obras dela
    └── styles/
        └── global.css
```

## Próximos passos sugeridos

1. Trocar os dados em `src/data/obras.js` pelas obras reais (fotos, títulos, descrições)
2. Trocar os emojis-placeholder (`icone`) por imagens de verdade — pode importar direto no `obras.js` ou colocar numa pasta `public/imagens/` e referenciar pelo caminho
3. Trocar `"[Nome da Artista]"` em `App.jsx` pelo nome dela
4. Rodar `npm run build` e escolher onde hospedar
