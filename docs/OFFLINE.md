# Offline-first

O aplicativo mantém coleções operacionais localmente e registra CREATE, UPDATE e DELETE em uma fila.

Estados da fila:
- PENDING
- SYNCING
- SYNCED
- ERROR/PENDING com mensagem de erro

Quando a conexão volta, a fila é processada automaticamente. A camada de sincronização está isolada para que o destino possa ser Firebase ou uma futura API REST.

A regra de segurança é nunca descartar uma operação local antes de confirmação do destino remoto.
