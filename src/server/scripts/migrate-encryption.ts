// src/server/scripts/migrate-encryption.ts
// Execução: npx tsx src/server/scripts/migrate-encryption.ts
// IMPORTANTE: Fazer backup do banco no Neon antes de executar em produção.
//
// Como funciona (idempotente):
// - Leitura: middleware tenta decrypt → falha em plaintext → mantém original
// - Escrita: middleware encripta automaticamente
// - Segunda execução: lê dado encriptado (decrypt ok), reescrita → encripta novamente (resultado idêntico)

import 'dotenv/config';
import { prisma } from '../lib/prisma.ts';
import { hashField } from '../lib/crypto.ts';

async function migrateNutritionists() {
  console.log('Migrando nutricionistas...');
  const records = await prisma.nutritionist.findMany({
    select: { id: true, cpf: true, cnpj: true },
  });

  let count = 0;
  for (const record of records) {
    await prisma.nutritionist.update({
      where: { id: record.id },
      data: {
        ...(record.cpf  != null ? { cpf: record.cpf }   : {}),
        ...(record.cnpj != null ? { cnpj: record.cnpj } : {}),
        cpfHash:  record.cpf  ? hashField(record.cpf)  : null,
        cnpjHash: record.cnpj ? hashField(record.cnpj) : null,
      },
    });
    count++;
  }
  console.log(`  ✓ ${count} nutricionistas migrados`);
}

async function migratePatients() {
  console.log('Migrando pacientes...');
  const records = await prisma.patient.findMany({
    select: { id: true, cpf: true, diseases: true, medications: true, allergies: true },
  });

  let count = 0;
  for (const record of records) {
    await prisma.patient.update({
      where: { id: record.id },
      data: {
        ...(record.cpf         != null ? { cpf: record.cpf }                 : {}),
        ...(record.diseases    != null ? { diseases: record.diseases }        : {}),
        ...(record.medications != null ? { medications: record.medications }  : {}),
        ...(record.allergies   != null ? { allergies: record.allergies }      : {}),
      },
    });
    count++;
  }
  console.log(`  ✓ ${count} pacientes migrados`);
}

async function migrateConsultations() {
  console.log('Migrando consultas...');
  const records = await prisma.consultation.findMany({
    select: { id: true, anamnesis: true, complaints: true },
  });

  let count = 0;
  for (const record of records) {
    await prisma.consultation.update({
      where: { id: record.id },
      data: {
        ...(record.anamnesis  != null ? { anamnesis: record.anamnesis }   : {}),
        ...(record.complaints != null ? { complaints: record.complaints } : {}),
      },
    });
    count++;
  }
  console.log(`  ✓ ${count} consultas migradas`);
}

async function migrateLabExams() {
  console.log('Migrando exames laboratoriais...');
  const records = await prisma.labExam.findMany({
    select: { id: true, observations: true, markers: true },
  });

  let count = 0;
  for (const record of records) {
    await prisma.labExam.update({
      where: { id: record.id },
      data: {
        ...(record.observations != null ? { observations: record.observations } : {}),
        ...(record.markers      != null ? { markers: record.markers }           : {}),
      },
    });
    count++;
  }
  console.log(`  ✓ ${count} exames migrados`);
}

async function main() {
  console.log('=== Iniciando migração de criptografia LGPD ===\n');
  await migrateNutritionists();
  await migratePatients();
  await migrateConsultations();
  await migrateLabExams();
  console.log('\n=== Migração concluída com sucesso ===');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Erro na migração:', err);
  process.exit(1);
});
