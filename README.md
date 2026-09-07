# MuscleMate

Sistema de correção postural em tempo real para exercícios de musculação.

## Visão geral

O MuscleMate usa a câmera do dispositivo e o modelo MoveNet, executado no navegador, para estimar pontos corporais, calcular ângulos articulares e fornecer feedback durante o exercício. A aplicação também contabiliza repetições, gera um relatório da série e salva o histórico autenticado no Supabase.

## Stack

- React, TypeScript e Vite
- TensorFlow.js, MoveNet e WebGL
- Supabase Auth e PostgreSQL
- Tailwind CSS, Radix UI e Framer Motion

## Exercícios suportados

Agachamento, rosca direta, supino, levantamento terra e afundo.

## Desenvolvimento local

Requisitos: Node.js 20+ e npm ou pnpm.

```bash
pnpm install
pnpm dev
```

Para validar o projeto:

```bash
pnpm exec tsc -p tsconfig.app.json --noEmit
pnpm lint
pnpm test
```

## Configuração do Supabase

Projeto ativo: `khjkayzjlizajambzgvy`.
URL: https://khjkayzjlizajambzgvy.supabase.co

A URL e a chave publicável estão em `src/integrations/supabase/client.ts`.
Essa chave foi feita para uso no navegador; as políticas RLS protegem os dados.
Não coloque chaves secretas, service_role ou senhas em código frontend.

O cliente está fixado no projeto ativo e não usa variáveis de ambiente antigas.
Isso também permite que o GitHub Actions publique a configuração correta sem
depender de um arquivo `.env`, que continua ignorado pelo Git.

A sessão usa uma chave de armazenamento específica deste projeto. Sessões de
outros projetos não são lidas nem reutilizadas.

No painel Authentication > URL Configuration, o Site URL e o retorno permitido
de produção são `https://andrezerg1.github.io/MuscleMate/`.
O cadastro exige confirmação de e-mail. O modo visitante não grava histórico.

## Banco de dados

As migrações do Supabase estão em `supabase/migrations`. Elas criam perfis, histórico de treinos, gatilho de novos usuários e políticas de segurança por usuário.

As tabelas foram provisionadas no projeto ativo pelo SQL Editor. Os arquivos de
migração servem como referência reproduzível da estrutura; não reaplique a criação
de tabelas sobre um banco já provisionado. Contas e históricos de outros projetos
não são transferidos automaticamente.

## Organização

- `src/pages`: telas da aplicação
- `src/components`: componentes visuais e navegação
- `src/lib/poseUtils.ts`: cálculo de ângulos, feedback e contador de repetições
- `src/lib/exercises.ts`: catálogo e critérios dos exercícios
- `src/integrations/supabase`: cliente e tipos do banco
