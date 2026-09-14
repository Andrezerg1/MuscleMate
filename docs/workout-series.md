# Treinos com múltiplas séries

## Fluxo

1. O usuário escolhe de 1 a 8 séries antes de começar.
2. Cada repetição completa é classificada como **correta**, **para melhorar** ou **incorreta**.
3. Ao finalizar uma série, o sistema mostra imediatamente totais, precisão, resumo e até quatro pontos recorrentes de melhoria.
4. O usuário inicia a próxima série ou encerra o treino antecipadamente.
5. Ao completar o planejamento, o treino é encerrado automaticamente e recebe um resumo consolidado.

O total de repetições é sempre calculado por `corretas + para melhorar + incorretas`. Tentativas que não chegam ao fim do ciclo do exercício não são consideradas repetições.

## Registro

Usuários autenticados gravam um registro consolidado na tabela existente `workout_sessions`. Os campos numéricos guardam os totais do treino. O campo `notes` guarda quantidade planejada/concluída, classificação de cada série e seus pontos de melhoria. Isso mantém compatibilidade com o banco atual sem migração destrutiva. Visitantes recebem os mesmos relatórios durante o uso, mas não criam histórico persistente.

## Segurança do estado

Durante uma série ou entre séries do mesmo treino, exercício, vista do agachamento e quantidade planejada ficam bloqueados. A câmera só pode ser desligada após finalizar a série atual, evitando perder silenciosamente as contagens acumuladas.
