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

## Variáveis de ambiente

Crie um arquivo `.env` local com:

```env
VITE_SUPABASE_PROJECT_ID=seu-projeto
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua-chave-publicável
```

O arquivo `.env` é ignorado pelo Git e nunca deve ser publicado.

## Banco de dados

As migrações do Supabase estão em `supabase/migrations`. Elas criam perfis, histórico de treinos, gatilho de novos usuários e políticas de segurança por usuário.

## Organização

- `src/pages`: telas da aplicação
- `src/components`: componentes visuais e navegação
- `src/lib/poseUtils.ts`: cálculo de ângulos, feedback e contador de repetições
- `src/lib/exercises.ts`: catálogo e critérios dos exercícios
- `src/integrations/supabase`: cliente e tipos do banco
