import type { GratitudeMission } from '../systems/GratitudeSystem';
import { FINAL_MELODY, PUZZLES } from './RotondaData';

/** Musical missions of level 1. Each one ends with someone thanking Rosa. */
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
    problem: 'Su nieto Bruno se ha perdido entre las algas de la superficie.',
    transformation: 'turtles-reunited',
    thanker: 'Doña Marea',
    message: '¡Gracias, Rosa!',
    followUps: ['Bruno ha vuelto a casa sano y salvo.', 'Toma: lo encontré entre las algas. Creo que es tuyo.'],
    tone: 'warm',
  },
  {
    id: 'gate',
    helper: 'La familia Payaso',
    problem: 'La Puerta de Coral se cerró al apagarse la música y no pueden volver a su gruta.',
    melody: PUZZLES.gate,
    transformation: 'coral-gate-open',
    thanker: 'La familia Payaso',
    message: '¡Gracias, Rosa!',
    followUps: ['¡Nuestra gruta vuelve a estar abierta!'],
    tone: 'warm',
  },
  {
    id: 'organ',
    helper: 'Las medusas de la Torre',
    problem: 'La corriente de la Torre de las Mareas se volvió del revés y ya no las sube a la luz.',
    melody: PUZZLES.organ,
    transformation: 'current-reversed',
    thanker: 'Las medusas de la Torre',
    message: '¡Gracias, Rosa the Dolphin!',
    followUps: ['La corriente vuelve a cantar hacia arriba.'],
    tone: 'warm',
  },
  {
    id: 'rotonda',
    helper: 'Toda la Rotonda Sumergida',
    problem: 'La melodía del lugar se rompió en siete fragmentos y el silencio lo apagó todo.',
    melody: FINAL_MELODY,
    transformation: 'rotonda-restored',
    thanker: 'Todos los habitantes de la Rotonda',
    message: '¡GRACIAS, ROSA THE DOLPHIN!',
    followUps: ['Has devuelto la música a la Rotonda.', 'Melodía completada.'],
    tone: 'grand',
  },
];
