import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const clients = [
  ['c1', 'Mariana Souza Lima', '1992-04-18', '(11) 98765-4321', 'mariana@email.com', '@marisouzalima', 'Rua das Acácias, 120 — Vila Mariana, São Paulo/SP', 'Indicação de uma amiga', 'Corte, hidratação e coloração', 'Prefere produtos sem sulfato e horários pela manhã', 'Sensibilidade no couro cabeludo com amônia. Fazer teste de mecha antes de colorir.', '2026-03-14', 'ativo', '2026-03-14T10:00:00.000Z'],
  ['c2', 'Juliana Ferreira Alves', '1988-11-02', '(11) 97654-1122', 'juliana.alves@email.com', '@ju.ferreira', 'Av. Paulista, 900, ap. 52 — Bela Vista, São Paulo/SP', 'Instagram', 'Cronograma capilar e escova', 'Gosta de finalização com volume', '', '2026-07-05', 'ativo', '2026-07-05T14:00:00.000Z'],
  ['c3', 'Camila Rocha Mendes', '1995-01-27', '(11) 99812-3344', 'camila.rocha@email.com', '@camirocha', 'Rua Harmonia, 45 — Pinheiros, São Paulo/SP', 'Google', 'Mechas e tonalização', 'Tons dourados, evita reflexos acinzentados', '', '2026-08-10', 'ativo', '2026-08-10T09:30:00.000Z'],
  ['c4', 'Beatriz Nogueira', '1979-06-09', '(11) 96543-7788', 'bia.nogueira@email.com', '', 'Rua Augusta, 1500 — Consolação, São Paulo/SP', 'Passou em frente ao salão', 'Corte', '', 'Mudou-se para outra cidade.', '2025-11-20', 'inativo', '2025-11-20T16:00:00.000Z'],
  ['c5', 'Patrícia Almeida Costa', '1990-09-15', '(11) 95432-6655', 'patricia.costa@email.com', '@paty.costa', 'Rua Tabapuã, 300 — Itaim Bibi, São Paulo/SP', 'Indicação', 'Progressiva e corte', 'Sem cheiro forte nos produtos', '', '2026-05-22', 'ativo', '2026-05-22T11:00:00.000Z'],
  ['c6', 'Renata Oliveira Santos', '1985-12-03', '(11) 94321-9090', 'renata.santos@email.com', '@renataoliveira', 'Rua Cardeal Arcoverde, 210 — Pinheiros, São Paulo/SP', 'Instagram', 'Tratamento para cachos', 'Finalização com fitagem', '', '2026-09-02', 'ativo', '2026-09-02T15:00:00.000Z'],
] as const;

const emptyHistory = {
  coloracao: { done: false, detail: '' },
  descoloracao: { done: false, detail: '' },
  progressiva: { done: false, detail: '' },
  relaxamento: { done: false, detail: '' },
  hena: { done: false, detail: '' },
  outros: { done: false, detail: '' },
};

const evaluations = [
  { id: 'e1', clientId: 'c1', date: '2026-03-14', sharedWithClient: true, hair: { types: ['Ondulado'], curvatures: ['2B'], thickness: 'Médio', density: 'Média', porosity: 'Alta', elasticity: 'Baixa', elasticityNotes: 'Fios rompem com facilidade quando molhados', states: ['Ressecado', 'Poroso'], stateOther: '' }, scalp: { types: ['Sensível'], flaking: 'Não', notes: 'Leve vermelhidão na região da nuca' }, history: { ...emptyHistory, coloracao: { done: true, detail: 'Castanho médio, há 8 meses' }, progressiva: { done: true, detail: 'Há 1 ano' } }, professional: { goal: 'Recuperar o brilho e a definição das ondas', diagnosis: 'Fios com porosidade alta e baixa elasticidade, resultado de química acumulada.', recommendedProcedure: 'Cronograma de reconstrução por 4 semanas', strandTest: 'Sim', strandResult: 'Elasticidade baixa — evitar descoloração', notes: 'Reavaliar em 30 dias.' }, createdAt: '2026-03-14T11:00:00.000Z' },
  { id: 'e2', clientId: 'c1', date: '2026-08-22', sharedWithClient: true, hair: { types: ['Ondulado'], curvatures: ['2B', '2C'], thickness: 'Médio', density: 'Média', porosity: 'Média', elasticity: 'Média', elasticityNotes: '', states: ['Ressecado'], stateOther: 'Pontas duplas' }, scalp: { types: ['Normal'], flaking: 'Não', notes: '' }, history: emptyHistory, professional: { goal: 'Manter a saúde dos fios e tirar as pontas', diagnosis: 'Boa evolução após a reconstrução: porosidade e elasticidade normalizadas.', recommendedProcedure: 'Corte de 3 cm e nutrição quinzenal', strandTest: 'Não', strandResult: '', notes: 'Liberada para coloração sem amônia.' }, createdAt: '2026-08-22T10:30:00.000Z' },
  { id: 'e3', clientId: 'c2', date: '2026-07-05', sharedWithClient: true, hair: { types: ['Cacheado'], curvatures: ['3A', '3B'], thickness: 'Fino', density: 'Alta', porosity: 'Média', elasticity: 'Alta', elasticityNotes: '', states: ['Opaco'], stateOther: '' }, scalp: { types: ['Oleoso'], flaking: 'Sim', notes: 'Descamação leve no topo' }, history: emptyHistory, professional: { goal: 'Cachos mais definidos e com brilho', diagnosis: 'Cachos saudáveis com perda de brilho e couro cabeludo oleoso.', recommendedProcedure: 'Detox capilar e hidratação com finalização', strandTest: 'Não', strandResult: '', notes: '' }, createdAt: '2026-07-05T15:00:00.000Z' },
  { id: 'e4', clientId: 'c1', date: '2026-09-30', sharedWithClient: false, hair: { types: ['Ondulado'], curvatures: ['2B'], thickness: 'Médio', density: 'Média', porosity: 'Média', elasticity: 'Média', elasticityNotes: '', states: [], stateOther: '' }, scalp: { types: ['Normal'], flaking: 'Não', notes: '' }, history: emptyHistory, professional: { goal: 'Acompanhamento pós-coloração', diagnosis: 'Rascunho: avaliar fixação da cor na próxima visita antes de compartilhar.', recommendedProcedure: 'Matização em 20 dias', strandTest: 'Não', strandResult: '', notes: 'Uso interno.' }, createdAt: '2026-09-30T09:00:00.000Z' },
];

function normalizeText(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

async function main() {
  const adminHash = await argon2.hash('admin123', { type: argon2.argon2id });
  const clientHash = await argon2.hash('cliente123', { type: argon2.argon2id });

  await prisma.revokedToken.deleteMany();
  await prisma.evaluation.deleteMany();
  await prisma.user.deleteMany();
  await prisma.client.deleteMany();

  for (const [id, name, birthDate, phone, email, instagram, address, howFound, usualProcedures, preferences, notes, firstVisit, status, createdAt] of clients) {
    await prisma.client.create({ data: { id, name, searchName: normalizeText(name), birthDate, phone, email, instagram, address, howFound, usualProcedures, preferences, notes, firstVisit, status, lgpdConsentAt: new Date(createdAt), createdAt: new Date(createdAt) } });
    await prisma.user.create({ data: { id: `u-${id}`, email, name, role: 'client', clientId: id, passwordHash: clientHash } });
  }

  await prisma.user.create({ data: { id: 'u-admin', email: 'admin@almeidahair.com', name: 'Fernanda Almeida', role: 'admin', passwordHash: adminHash } });

  for (const evaluation of evaluations) {
    await prisma.evaluation.create({ data: { ...evaluation, hair: evaluation.hair, scalp: evaluation.scalp, history: evaluation.history, professional: evaluation.professional, authorName: 'Fernanda Almeida', createdAt: new Date(evaluation.createdAt) } });
  }
}

main()
  .then(() => console.log('Banco populado com os dados de demonstração.'))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
