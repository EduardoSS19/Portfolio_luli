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

## Desenvolvimento local

Por segurança, o projeto assume `DEBUG=false` quando a variável não é definida. Para executar localmente, habilite o modo de desenvolvimento explicitamente e use uma chave exclusiva para sua máquina:

```bash
export DEBUG=true
export DJANGO_SECRET_KEY=local-development-only
python manage.py runserver
```

Não reutilize essa chave em produção e nunca versione arquivos com segredos.

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
- `GA4_PROPERTY_ID=563474943`: ID numérico da propriedade do Google Analytics 4.
- `GOOGLE_SERVICE_ACCOUNT_JSON`: conteúdo integral do JSON da conta de serviço, armazenado somente como variável secreta no Railway (nunca versionar). A conta precisa ter acesso **Leitor** à propriedade GA4 e a Google Analytics Data API precisa estar ativada no projeto Google Cloud.

O Django deriva as origens CSRF HTTPS dos hosts configurados. Depois de apontar o DNS e publicar, teste a página inicial, o login em `/admin/` e o formulário de contato.

## Métricas de acesso (Google Tag Manager + Google Analytics 4)

O painel administrativo consulta a Google Analytics Data API no backend Django. As métricas agregadas dos últimos 28 dias são armazenadas em cache por cinco minutos. A credencial da conta de serviço fica exclusivamente no Railway; o navegador não recebe a chave privada.

A integração usa o contêiner Web do Google Tag Manager configurado como padrão no frontend: `GTM-5ZQX38KB`. Não é necessário adicionar variável no Railway. Se necessário, `VITE_GTM_ID` pode sobrescrever o contêiner padrão.

1. No [Google Tag Manager](https://tagmanager.google.com/), abra o contêiner `GTM-5ZQX38KB`.
2. Crie uma tag **Google tag** com o ID de medição do GA4 `G-CQV1EDT3CC` e acionador **Initialization - All Pages** (ou **All Pages**).
3. Publique o contêiner no Tag Manager. Depois que esta alteração for integrada e implantada, o site começará a carregar o contêiner automaticamente.
4. Para enviar os eventos de interação ao GA4, crie tags de evento do Google Analytics 4 com acionadores de **Evento personalizado** para: `view_artwork`, `generate_lead`, `contact_click`, `outbound_click` e `gallery_view_change`. Mapeie os parâmetros desejados como variáveis da camada de dados.

Pré-visualizações privadas e a tela de diagnóstico da grade não são contabilizadas. O GA4 só começa a coletar dados depois da instalação; ele não recupera visitas anteriores. Os eventos podem aparecer no relatório em tempo real em poucos minutos, enquanto relatórios consolidados podem levar até 24–48 horas. Revise a política de privacidade e as informações de cookies do site antes de publicar a medição.

## Limpeza de imagens do Cloudinary

Ao substituir uma imagem ou excluir o registro que a utiliza, o Django agenda a remoção do arquivo antigo após a transação ser confirmada. Também existe a rotina `python manage.py limpar_cloudinary`, que primeiro lista imagens órfãs sem apagar nada. Para apagar, use `python manage.py limpar_cloudinary --apagar --idade-minima-horas 24`.

Para a varredura periódica, crie no Railway um segundo serviço do mesmo repositório, usando o arquivo de configuração `railway.cleanup.toml`. Ele executa a limpeza diariamente. A rotina limita a exclusão às pastas de upload gerenciadas pelo painel e ignora arquivos recentes; revise a primeira execução em modo de simulação antes de ativar a exclusão automática.
