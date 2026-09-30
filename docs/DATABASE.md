# Dados

A implementação original utiliza Firestore com isolamento por usuário e índices já existentes no repositório. Essa estrutura foi preservada durante a primeira etapa.

Modelo de domínio alvo:
User, Role, Permission, Property, Field, Crop, Season, Planting, Harvest, Spraying, Rainfall, Machine, Maintenance, Activity, Document, Notification, AuditLog, SyncOperation.

Uma futura migração PostgreSQL/Prisma deve ser feita com importação validada e período de coexistência, não por substituição abrupta.
