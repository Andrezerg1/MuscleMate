export interface Exercise {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  landmarks: string[];
  correctCriteria: string;
  commonErrors: { error: string; feedback: string }[];
  angleRange: { min: number; max: number; joint: string };
  cameraPosition: string;
}

export const exercises: Exercise[] = [
  {
    id: "squat",
    name: "Agachamento",
    nameEn: "Squat",
    description: "Exercício composto que trabalha quadríceps, glúteos e core. Fundamental para força de membros inferiores.",
    landmarks: ["Quadril", "Joelho", "Tornozelo"],
    correctCriteria: "Joelho alinhado com o pé; ângulo joelho 90°±10° na descida; coluna neutra",
    commonErrors: [
      { error: "Joelho para dentro (valgo)", feedback: "Empurre os joelhos para fora" },
      { error: "Amplitude incompleta", feedback: "Desça mais, paralelo ao chão" },
    ],
    angleRange: { min: 80, max: 100, joint: "Joelho" },
    cameraPosition: "Posicione-se de perfil para a câmera",
  },
  {
    id: "bicep-curl",
    name: "Rosca Direta",
    nameEn: "Bicep Curl",
    description: "Exercício isolado para bíceps. Requer controle do cotovelo junto ao tronco.",
    landmarks: ["Ombro", "Cotovelo", "Pulso"],
    correctCriteria: "Perfil para a câmera; cotovelo alinhado à linha escapular; contrair até o cotovelo passar de 90°",
    commonErrors: [
      { error: "Cotovelo à frente da linha escapular", feedback: "Mantenha o cotovelo alinhado ao ombro" },
      { error: "Amplitude incompleta", feedback: "Contraia até passar de 90°" },
    ],
    angleRange: { min: 30, max: 90, joint: "Cotovelo" },
    cameraPosition: "Fique de perfil (de lado) para a câmera, com ombro, cotovelo e punho visíveis",
  },
  {
    id: "bench-press",
    name: "Supino",
    nameEn: "Bench Press",
    description: "Exercício composto para peitorais, deltoides anteriores e tríceps.",
    landmarks: ["Ombro", "Cotovelo", "Pulso"],
    correctCriteria: "Cotovelo a 45°–75° do tronco; descida controlada até 90°",
    commonErrors: [
      { error: "Cotovelo muito aberto", feedback: "Feche os cotovelos" },
      { error: "Descida descontrolada", feedback: "Controle a descida" },
    ],
    angleRange: { min: 45, max: 75, joint: "Cotovelo" },
    cameraPosition: "Posicione a câmera de cima, capturando ombros e braços",
  },
  {
    id: "deadlift",
    name: "Levantamento Terra",
    nameEn: "Deadlift",
    description: "Exercício composto que trabalha toda a cadeia posterior — lombar, glúteos e isquiotibiais.",
    landmarks: ["Quadril", "Joelho", "Coluna (ombro-quadril)"],
    correctCriteria: "Coluna neutra; quadril como dobradiça",
    commonErrors: [
      { error: "Curvatura da lombar", feedback: "Mantenha as costas retas" },
      { error: "Joelho ultrapassando o pé", feedback: "Empurre o quadril para trás" },
    ],
    angleRange: { min: 160, max: 180, joint: "Coluna" },
    cameraPosition: "Posicione-se de perfil para a câmera, corpo inteiro visível",
  },
  {
    id: "lunge",
    name: "Afundo",
    nameEn: "Lunge",
    description: "Exercício unilateral para quadríceps, glúteos e estabilidade do core.",
    landmarks: ["Quadril", "Joelho anterior", "Tornozelo"],
    correctCriteria: "Joelho da frente a 90°; joelho não ultrapassa o pé; tronco ereto",
    commonErrors: [
      { error: "Joelho ultrapassa o pé", feedback: "Recue mais o passo" },
      { error: "Tronco inclinado", feedback: "Mantenha o tronco ereto" },
    ],
    angleRange: { min: 85, max: 95, joint: "Joelho" },
    cameraPosition: "Posicione-se de perfil para a câmera, pernas visíveis",
  },
];
