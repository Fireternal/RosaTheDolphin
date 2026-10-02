import type { GratitudeMission } from '../systems/GratitudeSystem';
import { FINAL_MELODY, PUZZLES } from './RotondaData';

/**
 * Musical missions of level 1. Each one ends with someone thanking Rosa —
 * whether or not she actually fixed anything (`reality` tells the truth).
 */
export const ROTONDA_MISSIONS: GratitudeMission[] = [
  {
    id: 'clam',
    helper: 'La Almeja Gigante',
    problem: 'Duerme tan profundamente que nadie puede llegar a lo que guarda.',
    transformation: 'clam-open',
    thanker: 'La Almeja Gigante',
    message: 'Mmmh… ¡gracias por despertarme, Rosa!',
    tone: 'small',
  },
  {
    id: 'bruno',
    helper: 'Doña Marea',
    problem: 'Su nieto Bruno se separó de ella en la cola de la rotonda y se perdió.',
    transformation: 'turtles-reunited',
    thanker: 'Doña Marea',
    message: '¡Gracias, Rosa!',
    followUps: ['Bruno ha vuelto a casa sano y salvo.', 'Toma: lo encontré entre las algas. Creo que es tuyo.'],
    tone: 'warm',
  },
  {
    id: 'gate',
    helper: 'Las familias delfín de la Rotonda',
    problem: 'No hay cuevas donde vivir: la gruta está cerrada y los delfines de aquí no tienen casa.',
    melody: PUZZLES.gate,
    transformation: 'grotto-filled-with-visitors',
    thanker: 'Los delfines alemanes',
    message: '¡Danke, Rosa!',
    followUps: ['¡Qué gruta tan bonita! Nos la quedamos.'],
    reality: 'Los delfines de aquí siguen sin casa. Y ahora hay todavía menos sitio para vivir.',
    tone: 'warm',
  },
  {
    id: 'organ',
    helper: 'Los vecinos del Emisario',
    problem: 'El emisario de la Torre vierte aguas residuales al mar.',
    melody: PUZZLES.organ,
    transformation: 'more-sewage',
    thanker: 'La Comisión de Inauguraciones',
    message: '¡Gracias, Rosa!',
    followUps: ['Ha inaugurado la nueva Gran Bomba del Emisario.'],
    reality: 'Ahora sale el triple de aguas residuales.',
    tone: 'warm',
  },
  {
    id: 'rotonda',
    helper: 'Las tortugas de la Rotonda',
    problem: 'Hay tantas tortugas en la corriente de la rotonda que se forman colas eternas y nadie avanza.',
    melody: FINAL_MELODY,
    transformation: 'rotonda-inaugurated',
    thanker: 'Toda la Coalición Delfinaria',
    message: '¡GRACIAS, ROSA THE DOLPHIN!',
    followUps: ['Ha inaugurado La Rotonda Sumergida.', 'Melodía completada.'],
    reality: 'La cola de tortugas sigue exactamente igual.',
    tone: 'grand',
  },
];
