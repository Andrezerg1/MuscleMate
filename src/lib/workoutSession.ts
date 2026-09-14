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
  summary: string;
  points: { message: string; count: number }[];
}

export interface WorkoutReport extends RepStats {
  exerciseName: string;
  plannedSeries: number;
  completedSeries: number;
  duration: number;
  accuracy: number;
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
  const summary = normalizedStats.reps === 0
    ? 'Nenhuma repetição completa foi detectada nesta série.'
    : stats.error === 0 && stats.warning === 0
      ? 'Série consistente do início ao fim — mantenha esse padrão.'
      : accuracy >= 70
        ? 'Boa série. Observe os pontos abaixo para refinar a execução.'
        : 'Priorize o controle do movimento e ajuste os pontos indicados antes da próxima série.';
  return { exerciseName, seriesNumber, ...normalizedStats, duration, accuracy, summary, points };
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
  const summary = totals.reps === 0
    ? 'Treino finalizado sem repetições completas detectadas.'
    : accuracy >= 85
      ? 'Ótima consistência entre as séries. Mantenha a execução controlada.'
      : accuracy >= 65
        ? 'Bom treino. Use os feedbacks de cada série para ganhar consistência.'
        : 'A execução variou durante o treino. Reduza o ritmo ou a carga e priorize a técnica.';
  return { exerciseName, plannedSeries, completedSeries: series.length, ...totals, duration, accuracy, summary, series };
}

export function workoutNotes(report: WorkoutReport) {
  const header = `Séries: ${report.completedSeries}/${report.plannedSeries}`;
  const details = report.series.map(item => {
    const points = item.points.map(point => `${point.message} (${point.count}x)`).join(', ');
    return `Série ${item.seriesNumber}: ${item.correct} corretas, ${item.warning} para melhorar, ${item.error} incorretas${points ? ` — ${points}` : ''}`;
  });
  return [header, ...details].join(' | ');
}
