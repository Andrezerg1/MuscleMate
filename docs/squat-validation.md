# Agachamento: duas vistas

## Comportamento

- **De frente:** observa cada joelho em relação à linha quadril–tornozelo e à posição inicial. Sinaliza deslocamento medial persistente; não diagnostica valgo tridimensional. Conta ciclos de descida e subida com alinhamento frontal, sem afirmar profundidade de 90°.
- **De lado:** mede flexão projetada do joelho, espera início em pé, descida até 105° ou menos (alvo 90° com margem de 15°) e retorno a pelo menos 155°, com quadril/tronco novamente em pé. Profundidades maiores não são rejeitadas automaticamente.
- A vista é fixa durante a série. Relatório e histórico identificam De frente/De lado pelo nome do exercício, mantendo o ID `squat` e o banco existente.
- O contador reinicia na troca de exercício/vista/série, parada da câmera ou ausência de amostras válidas por mais de 800 ms na lateral e 400 ms na frontal. Uma perda breve pausa a avaliação sem contar nem acumular permanência no fundo. Frames em voo de uma configuração anterior são ignorados.
- Feedback em um único painel: início, retorno e resultado estáveis. Desvios persistentes são informados ao concluir a tentativa, sem sobreposição na câmera ou números oscilando a cada quadro.

## Tolerâncias iniciais de câmera

Os valores em `src/lib/squatCounter.ts` são heurísticas ajustáveis, não limites clínicos validados:

- Posição inicial em pé: duas observações separadas por pelo menos 50 ms. Na vista lateral, a profundidade requer duas observações; na frontal, o pico é preservado mesmo em uma amostra rápida. A máquina mantém o erro até terminar a tentativa.
- Ciclo observado entre 120 ms e 20 s; intervalo sem amostra válida maior que 800 ms na lateral (400 ms na frontal) exige nova posição inicial.
- Medialização frontal: diferença em relação à posição inicial normalizada pelo comprimento projetado da perna (aviso >1,5%, rejeição >3,5%). Pernas avaliadas independentemente, considerando espelhamento.
- Frente: descida vertical do quadril relativa ao tornozelo, normalizada pela perna inicial. Saída da posição inicial: 8%; ciclo observado: 16%; retorno: até 6%. Esses números detectam movimento, não estimam a flexão sagital.
- Inclinação lateral do tronco: aviso acima de 55°, rejeição persistente acima de 70° ou para trás acima de 25°. O retorno exige alinhamento próximo ao inicial.
- Avanço horizontal joelho–tornozelo superior a 65% da canela inicial gera orientação, não rejeição automática. Mobilidade e proporções corporais influenciam esse avanço.

## Limites da medição

Na vista lateral, quadril, joelho e tornozelo da mesma perna com confiança a partir de 0,25 permitem acompanhar o ciclo. A perna permanece fixa durante a tentativa: pontos dos lados opostos não são combinados. O ombro pode estar oculto; nesse caso a amplitude continua sendo medida, mas o tronco aparece como não avaliado. Pontos de perna abaixo de 0,35 ou falhas de observação durante a tentativa geram um aviso de avaliação parcial no resultado, não uma aprovação completa da postura. O aviso descreve uma limitação da detecção, não um erro técnico do atleta.

A inclinação do tronco só é avaliada com ombro e quadril confiáveis (0,35). Um desvio já observado continua registrado mesmo se o ombro desaparecer depois. A tolerância de enquadramento lateral permite uma vista levemente oblíqua; a vista claramente frontal continua bloqueada quando o tronco é observável. Os limites de profundidade, extensão e desvios posturais foram preservados. Uma perda que esconda toda a profundidade não produz uma repetição validada.

Na câmera ao vivo, o desktop usa MoveNet MultiPose com dimensão máxima de 512 e o mobile mantém SinglePose Lightning. Vídeos enviados usam SinglePose Thunder em ambos, com foco em uma pessoa. A análise percorre o arquivo em passos de 100 ms, aguarda cada quadro decodificado e utiliza o tempo do vídeo nos contadores. Assim, processamento lento não pula trechos nem transforma latência do aparelho em perda de rastreamento. O último quadro amostrado é processado antes de concluir a série.

O seletor de pessoa permite a cadeia lateral quadril–joelho–tornozelo mesmo quando há menos de cinco pontos visíveis; sem essa exceção, a tolerância do contador não seria alcançada. Não combina lados opostos nem aceita coordenadas não finitas. Relatórios com limitações de visibilidade mostram avaliação parcial e observações, sem apresentar uma porcentagem de precisão técnica como se fosse uma reprovação da execução.

Validação local de regressão em 04/11/2026: no vídeo de referência fornecido pelo usuário (10,50 s, 476 × 848), MultiPose não retornou uma pessoa nos 105 quadros amostrados. SinglePose Thunder selecionou a pessoa nos 105 quadros e registrou três repetições, sem tentativas inválidas. O fluxo completo da tela com upload em modo visitante também registrou três repetições. Houve avisos de visibilidade e de avanço do joelho. Esse resultado é específico desse arquivo e não valida todos os vídeos, aparelhos ou a precisão biomecânica dos avisos. O arquivo de vídeo não é incluído no repositório.

MoveNet fornece ombros/quadris/joelhos/tornozelos. Não fornece curvatura lombar, pressão plantar ou ponto do calcanhar. A interface explicita que não confirma lombar nem apoio do calcanhar. O ângulo frontal não é usado para validar 90° de flexão. É preciso começar realmente em pé: uma imagem frontal isolada não distingue todas as posturas agachadas com segmentos sobrepostos.

As verificações automatizadas usam coordenadas sintéticas. Não substituem validação com pessoas e gravações de referência, especialmente em diferenças de estatura, roupa, oclusão e mobilidade. Não há garantia de reconhecimento de todos os desvios nem de zero falsos positivos.

## Verificações

`src/test/squatCounter.test.ts`: ciclos completos/parciais, profundidade com margem, inclinação frontal/traseira, avanço natural do joelho, oscilação isolada, perda de detecção, lado fixo, escalas/espelhamento, taxas de frames, interrupção, recuperação após erro e valgo unilateral/bilateral. Os testes da rosca direta continuam na suíte.

Referências de contexto (não validam os limiares acima):

- ACE, [How to Squat Properly: Body Type Breakdown & Anatomy Considerations](https://www.acefitness.org/resources/pros/expert-articles/7356/how-to-squat-properly-body-type-breakdown-anatomy-considerations/).
- [Quantifying frontal plane knee motion during single limb squats: reliability and validity of 2-dimensional measures](https://pmc.ncbi.nlm.nih.gov/articles/PMC4275194/). O estudo é de agachamento unilateral, portanto não estabelece os limiares do agachamento bilateral deste app.
