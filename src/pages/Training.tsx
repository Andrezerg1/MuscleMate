import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ArrowLeft, Check, ChevronRight, Dumbbell, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { TRAINING_EXERCISES, loadGuestWorkouts, newId, newSet, saveGuestWorkouts, workoutTotals, type TrainingExercise, type TrainingSet, type TrainingWorkout } from '@/lib/trainingLog';
import type { Database } from '@/integrations/supabase/types';

type Screen = 'list' | 'builder' | 'active';

type DatabaseError = { code?: string; message?: string } | null;

const saveErrorMessage = (error: DatabaseError, action: string) => {
  if (!navigator.onLine) return `Não foi possível ${action}: você está sem conexão com a internet.`;
  if (error?.code === '42501' || error?.message?.toLowerCase().includes('row-level security')) {
    return `Não foi possível ${action}: sua sessão não tem permissão para gravar este treino. Saia da conta, entre novamente e tente outra vez.`;
  }
  if (error?.code === '23514' || error?.code === '22P02') {
    return `Não foi possível ${action}: confira se repetições e carga contêm apenas valores válidos.`;
  }
  if (error?.code === '23505') return `Não foi possível ${action}: este registro já existe.`;
  return `Não foi possível ${action}. O banco de dados não respondeu como esperado; tente novamente em instantes.`;
};

const TrainingPage = () => {
  const { user } = useAuth();
  const [screen, setScreen] = useState<Screen>('list');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workouts, setWorkouts] = useState<TrainingWorkout[]>([]);
  const [activeWorkout, setActiveWorkout] = useState<TrainingWorkout | null>(null);
  const [name, setName] = useState('Meu treino');
  const [draftExercises, setDraftExercises] = useState<TrainingExercise[]>([]);

  const loadWorkouts = useCallback(async () => {
    setLoading(true);
    if (!user) {
      setWorkouts(loadGuestWorkouts());
      setLoading(false);
      return;
    }
    const { data: workoutRows, error } = await supabase.from('training_workouts').select('*').order('created_at', { ascending: false });
    if (error || !workoutRows) { toast.error(saveErrorMessage(error, 'carregar seus treinos')); setLoading(false); return; }
    const workoutIds = workoutRows.map(item => item.id);
    const { data: exerciseRows } = workoutIds.length ? await supabase.from('training_exercises').select('*').in('workout_id', workoutIds).order('position') : { data: [] };
    const exerciseIds = (exerciseRows ?? []).map(item => item.id);
    const { data: setRows } = exerciseIds.length ? await supabase.from('training_sets').select('*').in('workout_exercise_id', exerciseIds).order('set_number') : { data: [] };
    const mapped: TrainingWorkout[] = workoutRows.map(item => ({
      id:item.id, name:item.name, status:item.status as 'active'|'completed', startedAt:item.started_at, completedAt:item.completed_at,
      exercises:(exerciseRows ?? []).filter(exercise=>exercise.workout_id===item.id).map(exercise=>({
        id:exercise.id, exerciseId:exercise.exercise_id, exerciseName:exercise.exercise_name,
        analysisId:TRAINING_EXERCISES.find(option=>option.id===exercise.exercise_id)?.analysisId ?? null,
        postureEnabled:exercise.posture_enabled,
        sets:(setRows ?? []).filter(set=>set.workout_exercise_id===exercise.id).map(set=>({
          id:set.id,setNumber:set.set_number,targetReps:set.target_reps,actualReps:set.actual_reps,loadKg:Number(set.load_kg),
          correctReps:set.correct_reps,warningReps:set.warning_reps,errorReps:set.error_reps,completed:set.completed,
        })),
      })),
    }));
    setWorkouts(mapped);
    setLoading(false);
  }, [user]);

  useEffect(() => { void loadWorkouts(); }, [loadWorkouts]);

  const resetBuilder = () => { setName('Meu treino'); setDraftExercises([]); setScreen('builder'); };
  const addExercise = (exerciseId: string) => {
    const option = TRAINING_EXERCISES.find(item=>item.id===exerciseId);
    if (!option || draftExercises.some(item=>item.exerciseId===exerciseId)) return;
    setDraftExercises(items=>[...items, { id:newId(),exerciseId:option.id,exerciseName:option.name,analysisId:option.analysisId,postureEnabled:false,sets:[newSet(1),newSet(2),newSet(3)] }]);
  };
  const updateDraftSet = (exerciseId:string,setId:string,patch:Partial<TrainingSet>) => setDraftExercises(items=>items.map(exercise=>exercise.id!==exerciseId?exercise:{...exercise,sets:exercise.sets.map(set=>set.id===setId?{...set,...patch}:set)}));
  const addSet = (exerciseId:string) => setDraftExercises(items=>items.map(exercise=>exercise.id!==exerciseId?exercise:{...exercise,sets:[...exercise.sets,newSet(exercise.sets.length+1)]}));
  const removeSet = (exerciseId:string,setId:string) => setDraftExercises(items=>items.map(exercise=>exercise.id!==exerciseId?exercise:{...exercise,sets:exercise.sets.filter(set=>set.id!==setId).map((set,index)=>({...set,setNumber:index+1}))}));

  const persistGuest = (next:TrainingWorkout[]) => { setWorkouts(next); saveGuestWorkouts(next); };
  const startWorkout = async () => {
    if (!draftExercises.length) { toast.info('Adicione pelo menos um exercício.'); return; }
    if (draftExercises.some(exercise=>exercise.sets.length===0)) { toast.info('Cada exercício precisa ter pelo menos uma série.'); return; }
    if (draftExercises.some(exercise=>exercise.sets.some(set=>set.targetReps<1))) { toast.info('Informe as repetições planejadas de todas as séries.'); return; }
    setSaving(true);
    const base:TrainingWorkout = {id:newId(),name:name.trim()||'Meu treino',status:'active',startedAt:new Date().toISOString(),completedAt:null,exercises:draftExercises};
    if (!user) {
      const next=[base,...workouts]; persistGuest(next); setActiveWorkout(base); setScreen('active'); setSaving(false); return;
    }
    const { data:workoutRow,error } = await supabase.from('training_workouts').insert({user_id:user.id,name:base.name,status:'active'}).select().single();
    if (error || !workoutRow) { toast.error(saveErrorMessage(error, 'criar o treino')); setSaving(false); return; }
    const storedExercises:TrainingExercise[]=[];
    for (const [position,exercise] of draftExercises.entries()) {
      const {data:exerciseRow,error:exerciseError}=await supabase.from('training_exercises').insert({workout_id:workoutRow.id,exercise_id:exercise.exerciseId,exercise_name:exercise.exerciseName,position,posture_enabled:exercise.postureEnabled}).select().single();
      if (exerciseError || !exerciseRow) { await supabase.from('training_workouts').delete().eq('id',workoutRow.id); toast.error(saveErrorMessage(exerciseError, 'salvar os exercícios')); setSaving(false); return; }
      const {data:setRows,error:setError}=await supabase.from('training_sets').insert(exercise.sets.map(set=>({workout_exercise_id:exerciseRow.id,set_number:set.setNumber,target_reps:set.targetReps,load_kg:set.loadKg}))).select();
      if (setError || !setRows) { await supabase.from('training_workouts').delete().eq('id',workoutRow.id); toast.error(saveErrorMessage(setError, 'salvar as séries')); setSaving(false); return; }
      storedExercises.push({...exercise,id:exerciseRow.id,sets:setRows.map(set=>({id:set.id,setNumber:set.set_number,targetReps:set.target_reps,actualReps:set.actual_reps,loadKg:Number(set.load_kg),correctReps:0,warningReps:0,errorReps:0,completed:false}))});
    }
    const stored={...base,id:workoutRow.id,startedAt:workoutRow.started_at,exercises:storedExercises};
    setWorkouts(items=>[stored,...items]); setActiveWorkout(stored); setScreen('active'); setSaving(false);
  };

  const updateActiveSet = async (exerciseId:string,setId:string,patch:Partial<TrainingSet>) => {
    if (!activeWorkout) return;
    const next={...activeWorkout,exercises:activeWorkout.exercises.map(exercise=>exercise.id!==exerciseId?exercise:{...exercise,sets:exercise.sets.map(set=>set.id===setId?{...set,...patch}:set)})};
    setActiveWorkout(next);
    if (!user) { persistGuest(workouts.map(item=>item.id===next.id?next:item)); return; }
    const dbPatch:Database['public']['Tables']['training_sets']['Update']={};
    if ('actualReps' in patch) dbPatch.actual_reps=patch.actualReps;
    if ('loadKg' in patch) dbPatch.load_kg=patch.loadKg;
    if ('completed' in patch) { dbPatch.completed=patch.completed; dbPatch.completed_at=patch.completed?new Date().toISOString():null; }
    const { error } = await supabase.from('training_sets').update(dbPatch).eq('id',setId);
    if (error) {
      setActiveWorkout(activeWorkout);
      toast.error(saveErrorMessage(error, 'atualizar a série'));
    }
  };

  const completeWorkout = async () => {
    if (!activeWorkout) return;
    const completed={...activeWorkout,status:'completed' as const,completedAt:new Date().toISOString()};
    if (user) {
      const { error } = await supabase.from('training_workouts').update({status:'completed',completed_at:completed.completedAt}).eq('id',completed.id);
      if (error) { toast.error(saveErrorMessage(error, 'finalizar o treino')); return; }
    }
    const next=workouts.map(item=>item.id===completed.id?completed:item);
    if (!user) saveGuestWorkouts(next);
    setWorkouts(next); setActiveWorkout(null); setScreen('list'); toast.success('Treino registrado no histórico.');
  };

  const availableExercises=TRAINING_EXERCISES.filter(option=>!draftExercises.some(item=>item.exerciseId===option.id));
  const activeTotals=useMemo(()=>activeWorkout?workoutTotals(activeWorkout):null,[activeWorkout]);

  return <main className="min-h-screen pt-28 pb-20"><div className="container mx-auto max-w-5xl px-5 md:px-6">
    <div className="mb-7 flex items-end justify-between gap-4"><div><p className="eyebrow mb-2"><span className="h-1.5 w-1.5 rounded-full bg-primary"/> Registro de treino</p><h1 className="font-display text-3xl font-bold md:text-4xl">Meus treinos</h1><p className="mt-2 max-w-xl text-sm text-muted-foreground">Planeje carga e repetições. Use a correção postural somente quando quiser.</p></div>{screen==='list'&&<button onClick={resetBuilder} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground"><Plus className="h-4 w-4"/> Novo treino</button>}</div>

    {screen==='list' && (loading?<div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary"/></div>:workouts.length===0?<div className="surface rounded-3xl p-10 text-center"><Dumbbell className="mx-auto h-10 w-10 text-primary"/><h2 className="mt-4 font-display text-xl font-bold">Seu histórico começa aqui</h2><p className="mt-2 text-sm text-muted-foreground">Monte seu primeiro treino com séries, repetições e carga.</p><button onClick={resetBuilder} className="mt-5 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground">Criar primeiro treino</button></div>:<div className="space-y-3">{workouts.map(workout=>{const totals=workoutTotals(workout);return <button key={workout.id} onClick={()=>{setActiveWorkout(workout);setScreen('active')}} className="surface flex w-full items-center justify-between gap-4 rounded-2xl p-5 text-left transition-colors hover:border-primary/35"><div><div className="flex items-center gap-2"><p className="font-display font-bold">{workout.name}</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${workout.status==='completed'?'bg-success/10 text-success':'bg-warning/10 text-warning'}`}>{workout.status==='completed'?'Concluído':'Em andamento'}</span></div><p className="mt-1 text-xs text-muted-foreground">{new Date(workout.startedAt).toLocaleDateString('pt-BR')} · {totals.exercises} exercícios · {totals.completedSets}/{totals.sets} séries</p></div><div className="flex items-center gap-3"><span className="hidden text-xs text-muted-foreground sm:block">{totals.reps} reps · {Math.round(totals.volume)} kg</span><ChevronRight className="h-4 w-4 text-muted-foreground"/></div></button>})}</div>)}

    {screen==='builder'&&<div className="space-y-5"><button onClick={()=>setScreen('list')} className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4"/> Voltar</button><section className="surface rounded-2xl p-5"><label className="text-xs font-semibold text-muted-foreground">Nome do treino</label><input value={name} onChange={event=>setName(event.target.value)} className="mt-2 w-full bg-transparent font-display text-xl font-bold outline-none" placeholder="Ex.: Treino de força"/></section>
      {draftExercises.map(exercise=><section key={exercise.id} className="surface rounded-2xl p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="font-display text-lg font-bold">{exercise.exerciseName}</h2><label className={`mt-2 flex items-center gap-2 text-xs ${exercise.analysisId?'text-muted-foreground':'text-muted-foreground/60'}`}><input type="checkbox" checked={exercise.postureEnabled} disabled={!exercise.analysisId} onChange={event=>setDraftExercises(items=>items.map(item=>item.id===exercise.id?{...item,postureEnabled:event.target.checked}:item))}/> Correção postural {exercise.analysisId?'opcional':'em breve'}</label></div><button aria-label={`Remover ${exercise.exerciseName}`} onClick={()=>setDraftExercises(items=>items.filter(item=>item.id!==exercise.id))} className="rounded-lg p-2 text-muted-foreground hover:text-danger"><Trash2 className="h-4 w-4"/></button></div><div className="mt-4 grid grid-cols-[2rem_1fr_1fr_2rem] gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground"><span>#</span><span>Repetições</span><span>Carga (kg)</span><span/></div>{exercise.sets.map(set=><div key={set.id} className="mt-2 grid grid-cols-[2rem_1fr_1fr_2rem] items-center gap-2"><span className="text-sm text-muted-foreground">{set.setNumber}</span><input type="number" min="1" placeholder="Ex.: 10" value={set.targetReps===0?'':set.targetReps} onChange={event=>updateDraftSet(exercise.id,set.id,{targetReps:event.target.value===''?0:Math.max(1,Number(event.target.value))})} className="rounded-xl border border-border bg-background px-3 py-2 text-sm"/><input type="number" min="0" step="0.5" placeholder="Ex.: 20" value={set.loadKg===0?'':set.loadKg} onChange={event=>updateDraftSet(exercise.id,set.id,{loadKg:event.target.value===''?0:Math.max(0,Number(event.target.value))})} className="rounded-xl border border-border bg-background px-3 py-2 text-sm"/><button disabled={exercise.sets.length===1} onClick={()=>removeSet(exercise.id,set.id)} className="text-muted-foreground disabled:opacity-30"><XIcon/></button></div>)}<button onClick={()=>addSet(exercise.id)} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary"><Plus className="h-3.5 w-3.5"/> Adicionar série</button></section>)}
      {availableExercises.length>0&&<section className="rounded-2xl border border-dashed border-border p-5"><p className="text-sm font-semibold">Adicionar exercício</p><div className="mt-3 flex flex-wrap gap-2">{availableExercises.map(option=><button key={option.id} onClick={()=>addExercise(option.id)} className="rounded-full border border-border bg-card px-4 py-2 text-sm hover:border-primary/40">+ {option.name}</button>)}</div></section>}<button disabled={saving||!draftExercises.length} onClick={startWorkout} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-bold text-primary-foreground disabled:opacity-50">{saving?<Loader2 className="h-4 w-4 animate-spin"/>:<Save className="h-4 w-4"/>} Salvar e iniciar treino</button></div>}

    {screen==='active'&&activeWorkout&&<div className="space-y-5"><button onClick={()=>{setScreen('list');setActiveWorkout(null)}} className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4"/> Histórico</button><section className="rounded-3xl border border-primary/25 bg-primary/[0.06] p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-display text-xl font-bold">{activeWorkout.name}</p><p className="mt-1 text-xs text-muted-foreground">{activeTotals?.completedSets}/{activeTotals?.sets} séries · {activeTotals?.reps} repetições · {Math.round(activeTotals?.volume??0)} kg de volume</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${activeWorkout.status==='completed'?'bg-success/10 text-success':'bg-warning/10 text-warning'}`}>{activeWorkout.status==='completed'?'Treino concluído':'Treino em andamento'}</span></div></section>
      {activeWorkout.exercises.map(exercise=><section key={exercise.id} className="surface rounded-2xl p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-display text-lg font-bold">{exercise.exerciseName}</h2>{exercise.postureEnabled&&<p className="mt-1 text-xs text-primary">Correção postural ativada</p>}</div>{activeWorkout.status==='active'&&exercise.postureEnabled&&exercise.analysisId&&<Link to={`/analise?exercise=${exercise.analysisId}&series=${exercise.sets.length}&trainingExerciseId=${exercise.id}`} className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-bold text-primary"><Activity className="h-4 w-4"/> Usar correção postural</Link>}</div><div className="mt-4 grid grid-cols-[2rem_1fr_1fr_3rem] gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground"><span>#</span><span>Reps realizadas</span><span>Carga (kg)</span><span>Feita</span></div>{exercise.sets.map(set=><div key={set.id} className={`mt-2 grid grid-cols-[2rem_1fr_1fr_3rem] items-center gap-2 rounded-xl ${set.completed?'bg-success/[0.06]':''}`}><span className="pl-2 text-sm">{set.setNumber}</span><input disabled={activeWorkout.status==='completed'} type="number" min="0" placeholder={`${set.targetReps} alvo`} value={set.actualReps??''} onChange={event=>void updateActiveSet(exercise.id,set.id,{actualReps:event.target.value===''?null:Math.max(0,Number(event.target.value))})} className="rounded-xl border border-border bg-background px-3 py-2 text-sm disabled:opacity-70"/><input disabled={activeWorkout.status==='completed'} type="number" min="0" step="0.5" placeholder="0" value={set.loadKg===0?'':set.loadKg} onChange={event=>void updateActiveSet(exercise.id,set.id,{loadKg:event.target.value===''?0:Math.max(0,Number(event.target.value))})} className="rounded-xl border border-border bg-background px-3 py-2 text-sm disabled:opacity-70"/><button disabled={activeWorkout.status==='completed'} aria-label={`Marcar série ${set.setNumber} como ${set.completed?'pendente':'concluída'}`} onClick={()=>void updateActiveSet(exercise.id,set.id,{completed:!set.completed,actualReps:set.actualReps??set.targetReps})} className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full border ${set.completed?'border-success bg-success text-background':'border-border text-muted-foreground'}`}>{set.completed&&<Check className="h-4 w-4"/>}</button>{(set.correctReps+set.warningReps+set.errorReps)>0&&<p className="col-start-2 col-span-3 pb-2 text-[11px] text-muted-foreground">{set.correctReps} corretas · {set.warningReps} para melhorar · {set.errorReps} incorretas</p>}</div>)}</section>)}
      {activeWorkout.status==='active'&&<button onClick={completeWorkout} className="w-full rounded-2xl bg-primary py-4 text-sm font-bold text-primary-foreground">Finalizar e registrar treino</button>}</div>}
  </div></main>;
};

const XIcon=()=> <span aria-hidden="true" className="text-lg leading-none">×</span>;
export default TrainingPage;
