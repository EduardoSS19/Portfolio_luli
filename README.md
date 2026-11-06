# Luísa Becker

Um portfólio dedicado a práticas que atravessam matéria, imagem e experimentação. Cerâmica, Glitch Art, Gravura e Desenho convivem aqui como diferentes caminhos de pesquisa e criação. Um tempo especial dedicado a fazer algo para minha amada, com a cara dela. 

## Percursos

- **Cerâmica** — formas, superfícies e processos materiais.
- **Glitch Art** — imagem digital em transformação.
- **Gravura** — marcas, matrizes e reprodução.
- **Desenho** — estudos, gestos e observação.

## Sobre o portfólio

O site reúne obras, biografia e referências em uma experiência visual única. As imagens e os textos são organizados pelo painel editorial, permitindo atualizar o conteúdo sem alterar o código do site.

Construído com React, Vite e Django.
=======

## Contato e redes sociais

O Instagram pode ser configurado no campo **Instagram** do perfil da artista no Django Admin. Links adicionais podem ser gerenciados em **Links de redes sociais**; o Instagram do perfil aparece no rodapé mesmo quando existem outros links cadastrados.

O formulário envia as mensagens para o e-mail de contato do perfil. Em desenvolvimento, o Django usa o backend de console e imprime as mensagens no terminal. Em produção, configure no serviço:

- `EMAIL_HOST`: servidor SMTP.
- `EMAIL_PORT`: porta SMTP (normalmente `587` para TLS ou `465` para SSL).
- `EMAIL_HOST_USER` e `EMAIL_HOST_PASSWORD`: credenciais SMTP.
- `DEFAULT_FROM_EMAIL`: endereço remetente autorizado pelo provedor.
- `EMAIL_USE_TLS`: `true` para TLS ou `false` para SSL.
- `EMAIL_USE_SSL`: `true` para SSL ou `false` para TLS.

Configure também o e-mail de destino em **Perfil do portfólio → E-mail de contato** no Django Admin. Nunca coloque credenciais SMTP no frontend ou no repositório.
