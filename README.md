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

- **Perfil do portfólio:** atualize nome, frase de apresentação, foto, biografia e dados de contato. As quebras de linha feitas com Enter na biografia são preservadas no site.
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



## Produção (Railway + Cloudflare + Resend)

O deploy web é feito pelo Railway. O domínio público é gerenciado no Cloudflare: `www.lulibecker.com.br` e o domínio raiz são aceitos pelo Django. Configure o SSL/TLS do Cloudflare como **Full (strict)**; não use Flexible, pois o Django redireciona HTTP para HTTPS.

Variáveis principais no serviço web do Railway:

- `DEBUG=false`
- `DJANGO_SECRET_KEY`: segredo forte e exclusivo, definido no Railway (não versionar).
- `ALLOWED_HOSTS=www.lulibecker.com.br,lulibecker.com.br` (o domínio Railway é acrescentado automaticamente).
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
- `RESEND_API_KEY` e `DEFAULT_FROM_EMAIL`: remetente verificado no Resend.
- `DATABASE_URL`: conexão do banco PostgreSQL do Railway.
- `YOUTUBE_API_KEY`: necessária para buscar metadados ao cadastrar vídeos do YouTube.

O Django deriva as origens CSRF HTTPS dos hosts configurados. Depois de apontar o DNS e publicar, teste a página inicial, o login em `/admin/` e o formulário de contato.

## Métricas de acesso (Google Tag Manager + Google Analytics 4)

A integração é opcional e não adiciona dependências npm nem serviços ao Railway. Sem a variável abaixo, nenhuma tag do Google é carregada.

1. No [Google Tag Manager](https://tagmanager.google.com/), use o contêiner Web cujo ID começa com `GTM-`.
2. No serviço web do Railway, adicione `VITE_GTM_ID` com o ID do contêiner, por exemplo `GTM-5B9Z7J7C`.
3. No Tag Manager, crie uma tag **Google tag** com o ID de medição do GA4 (formato `G-XXXXXXXXXX`) e acionador **Initialization - All Pages** (ou **All Pages**).
4. Publique o contêiner no Tag Manager e faça um novo deploy do site no Railway para incorporar a variável.

O site envia eventos personalizados ao dataLayer: abertura de uma obra (`view_artwork`), envio bem-sucedido do formulário (`generate_lead`), clique no contato por e-mail (`contact_click`), saída para redes sociais (`outbound_click`) e troca do modo da galeria (`gallery_view_change`). Para enviar esses eventos ao GA4, crie no Tag Manager uma tag **Google Analytics: evento do GA4** para cada evento, usando o mesmo nome como acionador de **Evento personalizado**. Mapeie os parâmetros desejados como variáveis da camada de dados. Configure também a tag Google para enviar a visualização de página inicial. Pré-visualizações privadas e a tela de diagnóstico da grade não são contabilizadas.

O GA4 só começa a coletar dados depois da instalação; ele não recupera visitas anteriores. Os eventos podem aparecer no relatório em tempo real em poucos minutos, enquanto relatórios consolidados podem levar até 24–48 horas. Revise a política de privacidade e as informações de cookies do site antes de publicar a medição.

## Limpeza de imagens do Cloudinary

Ao substituir uma imagem ou excluir o registro que a utiliza, o Django agenda a remoção do arquivo antigo após a transação ser confirmada. Também existe a rotina `python manage.py limpar_cloudinary`, que primeiro lista imagens órfãs sem apagar nada. Para apagar, use `python manage.py limpar_cloudinary --apagar --idade-minima-horas 24`.

Para a varredura periódica, crie no Railway um segundo serviço do mesmo repositório, usando o arquivo de configuração `railway.cleanup.toml`. Ele executa a limpeza diariamente. A rotina limita a exclusão às pastas de upload gerenciadas pelo painel e ignora arquivos recentes; revise a primeira execução em modo de simulação antes de ativar a exclusão automática.
