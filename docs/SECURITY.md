# Segurança

## Correções aplicadas
- Removido o arquivo .env versionado que continha credenciais.
- Criado .env.example.
- .env passou a ser ignorado pelo Git.

## Regras
Nunca colocar segredos no bundle Expo. Chaves privadas de IA, banco ou serviços administrativos devem ficar no backend.

As configurações públicas do Firebase podem ser usadas no cliente conforme o modelo do Firebase, mas o controle de acesso deve permanecer nas Security Rules.

## Próximas camadas
- RBAC no backend
- auditoria
- rate limiting
- validação de payloads
- refresh token seguro
- monitoramento de eventos de segurança
