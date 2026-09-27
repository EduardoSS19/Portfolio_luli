# Portfólio — React + Django

## Desenvolvimento local

Em um terminal, instale e inicie o backend:

```bash
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py createsuperuser
.\.venv\Scripts\python.exe manage.py runserver
```

Em outro terminal, inicie o frontend:

```bash
npm.cmd install
npm.cmd run dev
```

O site abre em `http://localhost:5173`; o painel fica em `http://localhost:8000/admin/`. O Vite encaminha as chamadas `/api/` para o Django.

O Django Admin é a fonte do conteúdo do site. As quatro categorias são preservadas; cada uma inicia com uma obra de exemplo em Lorem ipsum, que pode ser editada, removida ou substituída. Referências começam vazias.

O item Perfil do portfólio controla o nome, a frase, a foto, a biografia, o Instagram, o e-mail e o formulário de contato. Separe os parágrafos da biografia com uma linha em branco. Imagens de fundo também podem ser cadastradas e ordenadas no Admin.

Arquivos locais em `public/` podem ser selecionados para upload no Admin, mas a pasta é ignorada pelo Git e pelo Docker. Uploads locais ficam em `media/`. Em produção, crie uma conta Cloudinary e informe `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` e `CLOUDINARY_API_SECRET` nas variáveis do serviço Render. O Blueprint solicita esses valores durante a configuração inicial; eles não devem ser adicionados ao Git.

## Publicação no Render

O arquivo `render.yaml` descreve o serviço Django/React e o banco PostgreSQL. Para publicar, envie o repositório ao GitHub, crie um Blueprint no Render e conecte esse repositório. O container aplica as migrações ao iniciar e publica site, API e painel no mesmo domínio.

O plano Free serve para teste: o serviço web pode dormir quando ocioso, e o Postgres gratuito expira após 30 dias. Faça upgrade do banco antes de cadastrar conteúdo que precise permanecer.

No primeiro start do serviço, as migrations rodam e o superusuário é criado com a senha informada pelo Blueprint em `DJANGO_SUPERUSER_PASSWORD`. O comando é idempotente: em reinícios seguintes não troca a senha de uma conta já criada.

O banco começa com as categorias e placeholders definidos pelas migrações. A pasta `dist/` é gerada durante a construção da imagem e não precisa ser versionada.
