# Luísa Becker

Um portfólio dedicado a práticas que atravessam matéria, imagem e experimentação. Cerâmica, Glitch Art, Gravura e Desenho convivem aqui como diferentes caminhos de pesquisa e criação. Um tempo especial dedicado a fazer algo para minha amada, com a cara dela. 

## Percursos

- **Cerâmica** — formas, superfícies e processos materiais.
- **Glitch Art** — imagem digital em transformação.
- **Gravura** — marcas, matrizes e reprodução.
- **Desenho** — estudos, gestos e observação.

## Sobre o portfólio

O site reúne obras, biografia e referências em uma experiência visual única. As imagens e os textos são organizados pelo painel editorial, permitindo atualizar o conteúdo sem alterar o código do site, o que da autonomia ao cliente! 

Construído com React, Vite e Django.

## Como atualizar o conteúdo

O conteúdo do site é administrado pelo painel do Django (`/admin/`). Não é necessário editar arquivos do projeto para atualizar textos, imagens ou obras.

- **Perfil do portfólio:** atualize nome, frase de apresentação, foto, biografia e dados de contato.
- **Obras:** crie ou edite uma obra dentro de sua categoria. A imagem principal aparece primeiro; imagens extras e vídeos do YouTube podem ser organizados no carrossel.
- **Categorias:** ajuste o título, a ordem e a publicação. Despublicar esconde o conteúdo do site sem apagá-lo.
- **Imagens de fundo:** é possível enviar várias imagens de uma vez e alterar sua ordem.
- **Referências e redes sociais:** mantenha links e informações complementares atualizados.

Antes de publicar alterações, confira se a obra está marcada como publicada e se a categoria também está publicada. Para remover algo temporariamente do site, use **Despublicar** em vez de excluir.

## Desenvolvimento e verificações

O projeto usa GitHub Actions para executar os testes do Django e compilar o frontend em pushes e pull requests. Localmente, as verificações principais são:

```bash
python manage.py check
python manage.py test
npm ci
npm run build
```

