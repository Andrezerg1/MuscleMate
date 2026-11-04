export interface RepStats {
  reps: number;
  correct: number;
  warning: number;
  error: number;
}

export interface SeriesReport extends RepStats {
  seriesNumber: number;
  exerciseName: string;
  duration: number;
  accuracy: number;
  limitedVisibility?: boolean;
  summary: string;
  points: { message: string; count: number }[];
}

export interface WorkoutReport extends RepStats {
  exerciseName: string;
  plannedSeries: number;
  completedSeries: number;
  duration: number;
  accuracy: number;
  limitedVisibility?: boolean;
  summary: string;
  series: SeriesReport[];
}

export function buildSeriesReport(
  exerciseName: string,
  seriesNumber: number,
  stats: RepStats,
  duration: number,
  issues: Record<string, number>,
): SeriesReport {
  const normalizedStats = { ...stats, reps: stats.correct + stats.warning + stats.error };
  const points = Object.entries(issues)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([message, count]) => ({ message, count }));
  const accuracy = normalizedStats.reps > 0 ? Math.round((normalizedStats.correct / normalizedStats.reps) * 100) : 0;
  const limitedVisibility = Object.entries(issues).some(([message,count]) => count > 0 && /não avaliado|visibilidade parcial|sem detecção/.test(message));
  const summary = normalizedStats.reps === 0
    ? 'Nenhuma repetição completa foi detectada nesta série.'
    : limitedVisibility ? 'Repetições registradas com avaliação parcial. A visibilidade não permitiu avaliar toda a postura; confira as observações abaixo.'
    : stats.error === 0 && stats.warning === 0
      ? 'Série consistente do início ao fim — mantenha esse padrão.'
      : accuracy >= 70
        ? 'Boa série. Observe os pontos abaixo para refinar a execução.'
        : 'Priorize o controle do movimento e ajuste os pontos indicados antes da próxima série.';
  return { exerciseName, seriesNumber, ...normalizedStats, duration, accuracy, limitedVisibility, summary, points };
}

export function buildWorkoutReport(
  exerciseName: string,
  plannedSeries: number,
  series: SeriesReport[],
  duration: number,
): WorkoutReport {
  const totals = series.reduce<RepStats>((sum, item) => ({
    reps: sum.reps + item.reps,
    correct: sum.correct + item.correct,
    warning: sum.warning + item.warning,
    error: sum.error + item.error,
  }), { reps: 0, correct: 0, warning: 0, error: 0 });
  const accuracy = totals.reps > 0 ? Math.round((totals.correct / totals.reps) * 100) : 0;
  const limitedVisibility = series.some(item => item.limitedVisibility);
  const summary = totals.reps === 0
    ? 'Treino finalizado sem repetições completas detectadas.'
    : limitedVisibility ? 'Treino registrado com avaliação parcial da postura. Falhas de visibilidade não significam execução incorreta; consulte as observações de cada série.'
    : accuracy >= 85
      ? 'Ótima consistência entre as séries. Mantenha a execução controlada.'
      : accuracy >= 65
        ? 'Bom treino. Use os feedbacks de cada série para ganhar consistência.'
        : 'A execução variou durante o treino. Reduza o ritmo ou a carga e priorize a técnica.';
  return { exerciseName, plannedSeries, completedSeries: series.length, ...totals, duration, accuracy, limitedVisibility, summary, series };
}

export function workoutNotes(report: WorkoutReport) {
  const header = `Séries: ${report.completedSeries}/${report.plannedSeries}`;
  const details = report.series.map(item => {
    const points = item.points.map(point => `${point.message} (${point.count}x)`).join(', ');
    return `Série ${item.seriesNumber}: ${item.correct} corretas, ${item.warning} ${item.limitedVisibility ? 'com observações (avaliação parcial)' : 'para melhorar'}, ${item.error} incorretas${points ? ` — ${points}` : ''}`;
  });
  return [header, ...details].join(' | ');
}
