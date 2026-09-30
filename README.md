# W3Labs Agro

Plataforma de gestão agrícola para operação de campo e gestão administrativa, com Web/PWA e Android/iOS via Expo.

## Reconstrução atual

A primeira etapa da reconstrução foi aplicada diretamente na branch **master**, preservando as funcionalidades Firebase existentes e evitando uma migração destrutiva.

### Entregue
- Dashboard responsivo com foco em operação de campo.
- Navegação para propriedades, talhões, culturas, safras, plantio, colheita, pulverização, chuva, manutenção, atividades, documentos e relatórios.
- Design tokens agrícolas centralizados.
- Módulos reutilizáveis de CRUD local.
- Persistência offline com AsyncStorage.
- Fila de sincronização CREATE/UPDATE/DELETE.
- Detecção de conectividade com NetInfo.
- Documentação de arquitetura, offline-first, segurança, dados, API, deploy e contribuição.
- Remoção do .env versionado que continha credenciais.
- .env.example para configuração local.
- Build Web via Expo.

## Arquitetura preservada

O projeto existente já possui autenticação Firebase, Firestore, Storage, regras e serviços de domínio. Esses recursos foram preservados porque representam lógica e dados reais do produto.

A evolução para PostgreSQL/Prisma + API REST deve ocorrer de forma incremental, com migração e validação de dados, sem apagar o backend funcional antes de existir paridade.

## Executar

```bash
npm install
npx expo start
```

Web:

```bash
npm run web
```

Build Web:

```bash
npm run build:web
```

Configure as variáveis do `.env.example` em um `.env` local.

## Documentação

- [Architecture](docs/ARCHITECTURE.md)
- [Offline](docs/OFFLINE.md)
- [Security](docs/SECURITY.md)
- [Database](docs/DATABASE.md)
- [API](docs/API.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Contributing](docs/CONTRIBUTING.md)

## Branch principal

As alterações desta etapa foram aplicadas **na mesma branch master**, conforme solicitado.
