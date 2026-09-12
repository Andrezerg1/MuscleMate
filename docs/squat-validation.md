# Agachamento: duas vistas

## Comportamento

- **De frente:** observa cada joelho em relação à linha quadril–tornozelo e à posição inicial. Sinaliza deslocamento medial persistente; não diagnostica valgo tridimensional. Conta ciclos de descida e subida com alinhamento frontal, sem afirmar profundidade de 90°.
- **De lado:** mede flexão projetada do joelho, espera início em pé, descida até 105° ou menos (alvo 90° com margem de 15°) e retorno a pelo menos 155°, com quadril/tronco novamente em pé. Profundidades maiores não são rejeitadas automaticamente.
- A vista é fixa durante a série. Relatório e histórico identificam De frente/De lado pelo nome do exercício, mantendo o ID `squat` e o banco existente.
- O contador reinicia na troca de exercício/vista/série, parada da câmera ou ausência de amostras válidas por mais de 350 ms. Uma perda breve pausa a avaliação sem contar nem acumular permanência no fundo. Frames em voo de uma configuração anterior são ignorados.
- Feedback em um único painel: início, retorno e resultado estáveis. Desvios persistentes são informados ao concluir a tentativa, sem sobreposição na câmera ou números oscilando a cada quadro.

## Tolerâncias iniciais de câmera

Os valores em `src/lib/squatCounter.ts` são heurísticas ajustáveis, não limites clínicos validados:

- Posição em pé: pelo menos duas observações durante 150 ms; fundo: 80 ms; desvio persistente: 180 ms. A máquina mantém o erro até terminar a tentativa.
- Ciclo lateral entre 600 ms e 20 s; intervalo entre frames maior que 350 ms exige nova posição inicial.
- Medialização frontal: diferença em relação à posição inicial normalizada pelo comprimento projetado da perna (aviso >4,5%, rejeição >8%). Pernas avaliadas independentemente, considerando espelhamento.
- Frente: descida vertical do quadril relativa ao tornozelo, normalizada pela perna inicial. Saída da posição inicial: 8%; ciclo observado: 16%; retorno: até 6%. Esses números detectam movimento, não estimam a flexão sagital.
- Inclinação lateral do tronco: aviso acima de 55°, rejeição persistente acima de 70° ou para trás acima de 25°. O retorno exige alinhamento próximo ao inicial.
- Avanço horizontal joelho–tornozelo superior a 65% da canela inicial gera orientação, não rejeição automática. Mobilidade e proporções corporais influenciam esse avanço.

## Limites da medição

MoveNet fornece ombros/quadris/joelhos/tornozelos. Não fornece curvatura lombar, pressão plantar ou ponto do calcanhar. A interface explicita que não confirma lombar nem apoio do calcanhar. O ângulo frontal não é usado para validar 90° de flexão. É preciso começar realmente em pé: uma imagem frontal isolada não distingue todas as posturas agachadas com segmentos sobrepostos.

As verificações automatizadas usam coordenadas sintéticas. Não substituem validação com pessoas e gravações de referência, especialmente em diferenças de estatura, roupa, oclusão e mobilidade. Não há garantia de reconhecimento de todos os desvios nem de zero falsos positivos.

## Verificações

`src/test/squatCounter.test.ts`: ciclos completos/parciais, profundidade com margem, inclinação frontal/traseira, avanço natural do joelho, oscilação isolada, perda de detecção, lado fixo, escalas/espelhamento, taxas de frames, interrupção, recuperação após erro e valgo unilateral/bilateral. Os testes da rosca direta continuam na suíte.

Referências de contexto (não validam os limiares acima):

- ACE, [How to Squat Properly: Body Type Breakdown & Anatomy Considerations](https://www.acefitness.org/resources/pros/expert-articles/7356/how-to-squat-properly-body-type-breakdown-anatomy-considerations/).
- [Quantifying frontal plane knee motion during single limb squats: reliability and validity of 2-dimensional measures](https://pmc.ncbi.nlm.nih.gov/articles/PMC4275194/). O estudo é de agachamento unilateral, portanto não estabelece os limiares do agachamento bilateral deste app.
