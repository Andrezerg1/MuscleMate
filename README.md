# MuscleMate

Sistema web de correção postural em tempo real e registro de treinos de musculação.

## Funcionalidades

- análise postural pela câmera;
- contagem e classificação de repetições;
- feedback durante a execução dos exercícios;
- planejamento de exercícios, séries, repetições e cargas;
- histórico de treinos;
- autenticação e modo visitante.

## Tecnologias

- React
- TypeScript
- Vite
- TensorFlow.js e MoveNet
- WebGL
- Supabase Auth, PostgreSQL e Storage
- Tailwind CSS
- Radix UI
- Framer Motion
- Vitest e ESLint
- GitHub Pages

## Arquitetura

O MuscleMate utiliza uma aplicação web modular executada no navegador, integrada a serviços gerenciados de autenticação e persistência.

As decisões técnicas e suas justificativas estão documentadas no [ADR 0001 — Arquitetura geral do MuscleMate](docs/adr/0001-arquitetura-geral.md).

## Segurança

Credenciais privadas, senhas, chaves administrativas e arquivos de ambiente não devem ser versionados no repositório.
