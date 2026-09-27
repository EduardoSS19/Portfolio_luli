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

O Django Admin permite editar categorias, obras, referências e links. As imagens são cadastradas como URLs ou caminhos de arquivos publicados em `public/`.

## Publicação no Render

O arquivo `render.yaml` descreve o serviço Django/React e o banco PostgreSQL. Para publicar, envie o repositório ao GitHub, crie um Blueprint no Render e conecte esse repositório. O Render constrói o frontend, roda as migrações e publica site, API e painel no mesmo domínio.

Depois do primeiro deploy, crie o usuário do painel pelo Shell do serviço no Render:

```bash
python manage.py createsuperuser
```

O banco começa com as categorias, obras e referências que já estão nos arquivos locais. A pasta `dist/` é gerada durante a construção da imagem e não precisa ser versionada.
