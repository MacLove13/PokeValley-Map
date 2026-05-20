# PokeValley-Map

Aplicação web com mapa Leaflet, login via Discord e área autenticada para criar marcadores e imagens PNG compartilhadas.

## Requisitos

- Node.js 20+
- Aplicação OAuth2 no Discord

## Configuração

```bash
npm install
```

Variáveis de ambiente:

- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_CALLBACK_URL` (ex.: `http://localhost:3000/auth/discord/callback`)
- `SESSION_SECRET` (recomendado em produção)
- `AUTHORIZED_DISCORD_IDS` (opcional, padrão: `276547936916078592`)

## Executar

```bash
npm start
```

Abra `http://localhost:3000`.

## Docker

Copie o arquivo de exemplo e preencha com suas credenciais:

```bash
cp .env.example .env
```

Inicie com Docker Compose:

```bash
docker compose up
```

Abra `http://localhost:3000`. Os dados persistem nas pastas `data/` e `uploads/` do projeto.

## Testes

```bash
npm test
```
