import { LandingNavbar } from '../components/LandingNavbar';
import { LandingFooter } from '../components/LandingFooter';

const Section = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => (
  <section id={id} className="space-y-4 scroll-mt-24">
    <h2 className="text-xl font-bold text-foreground border-b border-border pb-2">{title}</h2>
    {children}
  </section>
);

const P = ({ children }: { children: React.ReactNode }) => (
  <p className="text-muted-foreground leading-relaxed text-sm">{children}</p>
);

const Li = ({ children }: { children: React.ReactNode }) => (
  <li className="flex gap-2 text-sm text-muted-foreground leading-relaxed">
    <span className="text-primary mt-0.5 shrink-0">•</span>
    <span>{children}</span>
  </li>
);

const Table = ({ headers, rows }: { headers: string[]; rows: string[][] }) => (
  <div className="overflow-x-auto rounded-lg border border-border">
    <table className="w-full text-sm">
      <thead className="bg-muted/40">
        <tr>
          {headers.map(h => (
            <th key={h} className="px-4 py-2.5 text-left font-semibold text-foreground text-xs uppercase tracking-wide">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {rows.map((row, i) => (
          <tr key={i} className="hover:bg-muted/20">
            {row.map((cell, j) => (
              <td key={j} className="px-4 py-2.5 text-muted-foreground align-top">{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

import React from 'react';

export function Privacidade() {
  const toc = [
    { id: 'controlador', label: '1. Controlador dos Dados' },
    { id: 'dados-coletados', label: '2. Dados Pessoais Coletados' },
    { id: 'dados-sensiveis', label: '3. Dados Sensíveis' },
    { id: 'finalidades', label: '4. Finalidades e Bases Legais' },
    { id: 'retencao', label: '5. Prazo de Retenção' },
    { id: 'compartilhamento', label: '6. Compartilhamento com Terceiros' },
    { id: 'transferencia', label: '7. Transferência Internacional' },
    { id: 'seguranca', label: '8. Segurança dos Dados' },
    { id: 'direitos', label: '9. Seus Direitos (LGPD Art. 18)' },
    { id: 'cookies', label: '10. Cookies e Rastreamento' },
    { id: 'menores', label: '11. Menores de Idade' },
    { id: 'alteracoes', label: '12. Alterações desta Política' },
    { id: 'contato', label: '13. Contato e DPO' },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingNavbar />

      <main className="pt-24 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">

          {/* Header */}
          <div className="mb-10">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-primary bg-primary/10 px-3 py-1 rounded-full mb-4">
              LGPD — Lei 13.709/2018
            </div>
            <h1 className="text-4xl font-bold mb-3">Política de Privacidade</h1>
            <p className="text-muted-foreground text-sm">
              Última atualização: maio de 2026 · Versão 2.0
            </p>
            <p className="text-muted-foreground text-sm mt-3 max-w-2xl leading-relaxed">
              Esta Política descreve como o <strong className="text-foreground">Nutrir</strong> coleta, usa, armazena e protege seus dados pessoais,
              em conformidade com a Lei Geral de Proteção de Dados Pessoais (LGPD — Lei nº 13.709/2018)
              e demais normas brasileiras aplicáveis.
            </p>
          </div>

          <div className="flex gap-10">

            {/* Sumário lateral (desktop) */}
            <aside className="hidden lg:block w-56 shrink-0">
              <div className="sticky top-24 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Sumário</p>
                {toc.map(item => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className="block text-xs text-muted-foreground hover:text-foreground transition-colors py-0.5"
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            </aside>

            {/* Conteúdo */}
            <div className="flex-1 space-y-10 min-w-0">

              <Section id="controlador" title="1. Controlador dos Dados">
                <P>
                  O <strong className="text-foreground">Nutrir</strong> é o Controlador de Dados responsável pelo tratamento das informações
                  pessoais coletadas nesta plataforma, nos termos do Art. 5º, VI da LGPD.
                </P>
                <div className="bg-muted/30 rounded-lg p-4 text-sm space-y-1">
                  <p><span className="font-semibold text-foreground">Razão Social:</span> <span className="text-muted-foreground">Nutrir Tecnologia Ltda.</span></p>
                  <p><span className="font-semibold text-foreground">E-mail do DPO:</span> <a href="mailto:privacidade@nutrir.app" className="text-primary hover:underline">privacidade@nutrir.app</a></p>
                  <p><span className="font-semibold text-foreground">Foro:</span> <span className="text-muted-foreground">São Paulo — SP, Brasil</span></p>
                </div>
              </Section>

              <Section id="dados-coletados" title="2. Dados Pessoais Coletados">
                <P>Coletamos dados diretamente fornecidos pelo usuário e dados gerados automaticamente durante o uso da plataforma.</P>

                <p className="text-sm font-semibold text-foreground">2.1 Dados do Nutricionista (Titular da Conta)</p>
                <ul className="space-y-1 ml-1">
                  <Li><strong>Identificação:</strong> nome completo, e-mail, CPF ou CNPJ, número do CRN</Li>
                  <Li><strong>Contato:</strong> telefone</Li>
                  <Li><strong>Profissional:</strong> especialidades, foto de perfil</Li>
                  <Li><strong>Assinatura:</strong> status do plano, datas de início e fim, ID da assinatura (Asaas)</Li>
                  <Li><strong>Integração:</strong> tokens OAuth do Google Calendar (quando autorizado)</Li>
                  <Li><strong>Técnicos:</strong> data de criação da conta, último login, preferências do sistema</Li>
                </ul>

                <p className="text-sm font-semibold text-foreground mt-4">2.2 Dados dos Pacientes (Inseridos pelo Nutricionista)</p>
                <P>O nutricionista insere dados de seus pacientes na plataforma. Nessa relação, o nutricionista atua como Operador de Dados perante seus pacientes, sendo responsável pela obtenção do consentimento deles conforme Art. 7º da LGPD.</P>
                <ul className="space-y-1 ml-1">
                  <Li><strong>Identificação:</strong> nome completo, CPF, data de nascimento, gênero</Li>
                  <Li><strong>Contato:</strong> e-mail, telefone, endereço</Li>
                  <Li><strong>Saúde:</strong> objetivo nutricional, nível de atividade física</Li>
                  <Li><strong>Financeiro:</strong> registros de pagamento (valor, data, método, status)</Li>
                </ul>

                <p className="text-sm font-semibold text-foreground mt-4">2.3 Dados Gerados Automaticamente</p>
                <ul className="space-y-1 ml-1">
                  <Li>Logs de acesso e eventos de uso (login, logout, erros) — coletados via Axiom</Li>
                  <Li>Endereço IP (processado pelo Firebase/Google de forma indireta)</Li>
                  <Li>Dados de sessão armazenados no navegador (localStorage)</Li>
                </ul>
              </Section>

              <Section id="dados-sensiveis" title="3. Dados Sensíveis">
                <P>
                  Nos termos do Art. 5º, II e Art. 11 da LGPD, os dados abaixo são classificados como <strong className="text-foreground">dados pessoais sensíveis</strong> por
                  se referirem à saúde dos pacientes. Seu tratamento é realizado exclusivamente para prestação do serviço de nutrição:
                </P>
                <ul className="space-y-1 ml-1">
                  <Li>Diagnósticos, doenças e condições clínicas</Li>
                  <Li>Medicamentos em uso</Li>
                  <Li>Alergias e intolerâncias alimentares</Li>
                  <Li>Dados antropométricos: peso, altura, IMC, percentual de gordura, circunferências corporais</Li>
                  <Li>Resultados de exames laboratoriais e marcadores bioquímicos</Li>
                  <Li>Registros de anamnese e evolução clínica</Li>
                  <Li>Planos alimentares individualizados</Li>
                </ul>
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-xs text-amber-800 dark:text-amber-200">
                  ⚠️ O nutricionista é responsável por obter o consentimento expresso de seus pacientes para o tratamento
                  desses dados sensíveis antes de inseri-los na plataforma (LGPD Art. 11, I).
                </div>
              </Section>

              <Section id="finalidades" title="4. Finalidades e Bases Legais">
                <P>Todo tratamento de dados é realizado com uma finalidade determinada e apoiado em uma base legal prevista na LGPD (Art. 7º e Art. 11).</P>
                <Table
                  headers={['Dado', 'Finalidade', 'Base Legal (LGPD)']}
                  rows={[
                    ['Nome, e-mail, CRN', 'Criação e gestão da conta', 'Art. 7º, V — execução de contrato'],
                    ['CPF / CNPJ', 'Identificação e emissão de documentos fiscais', 'Art. 7º, V — execução de contrato'],
                    ['Dados do paciente', 'Prestação do serviço de nutrição', 'Art. 7º, V + Art. 11, II, f — tutela da saúde'],
                    ['Dados de saúde do paciente', 'Tratamento clínico e acompanhamento nutricional', 'Art. 11, I — consentimento do titular'],
                    ['Dados de pagamento', 'Processamento de assinatura e cobranças', 'Art. 7º, V — execução de contrato'],
                    ['Logs de uso (Axiom)', 'Diagnóstico de erros e melhoria do serviço', 'Art. 7º, IX — legítimo interesse (com consentimento via banner)'],
                    ['E-mail', 'Envio de comunicações transacionais e suporte', 'Art. 7º, V — execução de contrato'],
                    ['OAuth Google Calendar', 'Sincronização de agenda (somente se autorizado)', 'Art. 7º, I — consentimento'],
                  ]}
                />
              </Section>

              <Section id="retencao" title="5. Prazo de Retenção">
                <P>Os dados são mantidos pelo tempo necessário às finalidades descritas e conforme obrigações legais.</P>
                <Table
                  headers={['Categoria', 'Prazo de Retenção', 'Fundamento']}
                  rows={[
                    ['Dados da conta do nutricionista', 'Enquanto a conta estiver ativa + 5 anos após encerramento', 'Obrigação legal contábil/fiscal'],
                    ['Dados de pacientes', 'Enquanto o nutricionista mantiver a conta ativa', 'Execução do contrato de serviço'],
                    ['Registros de saúde do paciente', '20 anos após a última consulta registrada', 'CFM/CFN — prontuário mínimo'],
                    ['Dados de pagamento', '5 anos', 'Lei 9.613/1998 e Código Tributário Nacional'],
                    ['Logs de acesso (Axiom)', '90 dias', 'Legítimo interesse para diagnóstico'],
                    ['Tokens OAuth (Google Calendar)', 'Até revogação pelo usuário', 'Consentimento'],
                    ['Dados após exclusão da conta', 'Anonimizados ou excluídos em até 30 dias', 'Art. 16 LGPD'],
                  ]}
                />
                <P>
                  Após o término dos prazos, os dados são excluídos de forma segura ou anonimizados irreversivelmente,
                  conforme Art. 16 da LGPD.
                </P>
              </Section>

              <Section id="compartilhamento" title="6. Compartilhamento com Terceiros">
                <P>
                  Não vendemos, alugamos nem comercializamos dados pessoais. O compartilhamento ocorre exclusivamente
                  com fornecedores de serviços essenciais ao funcionamento da plataforma, mediante acordos de
                  confidencialidade e tratamento de dados (DPA — Data Processing Agreement).
                </P>
                <Table
                  headers={['Fornecedor', 'País', 'Finalidade', 'Dados Compartilhados']}
                  rows={[
                    ['Firebase / Google', 'EUA (servidores globais)', 'Autenticação, banco de dados, armazenamento', 'Todos os dados armazenados na plataforma'],
                    ['Asaas Pagamentos', 'Brasil', 'Processamento de assinaturas e cobranças', 'CPF/CNPJ, e-mail, dados de pagamento'],
                    ['Brevo (ex-Sendinblue)', 'França (UE)', 'Envio de e-mails transacionais', 'Nome, e-mail'],
                    ['Axiom', 'EUA', 'Logs de observabilidade (somente com consentimento)', 'Logs de eventos (userId, ações)'],
                    ['Google Calendar API', 'EUA', 'Sincronização de agenda (somente se integrado)', 'Dados de agendamentos'],
                  ]}
                />
              </Section>

              <Section id="transferencia" title="7. Transferência Internacional de Dados">
                <P>
                  Alguns fornecedores listados acima operam fora do Brasil (principalmente nos EUA e UE).
                  Essas transferências são realizadas com base no Art. 33, I da LGPD, mediante:
                </P>
                <ul className="space-y-1 ml-1">
                  <Li>
                    <strong>Autenticação:</strong> Google Firebase Authentication (Google LLC, EUA) — protegido pelo{' '}
                    <a
                      href="https://cloud.google.com/terms/data-processing-addendum"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      DPA do Google Cloud
                    </a>.
                  </Li>
                  <Li>
                    <strong>Banco de dados:</strong> Neon PostgreSQL (infraestrutura AWS, EUA) — protegido pelo DPA da AWS e Neon.
                  </Li>
                  <Li><strong>Brevo:</strong> empresa europeia, regulada pelo GDPR, com nível de proteção equivalente à LGPD</Li>
                  <Li><strong>Axiom:</strong> transferência baseada em cláusulas contratuais padrão; coleta somente com consentimento do usuário</Li>
                </ul>
                <P>
                  Ambos os provedores adotam cláusulas contratuais padrão e estão em conformidade com
                  regulamentações internacionais de proteção de dados. O usuário pode solicitar informações
                  sobre os instrumentos de transferência utilizados pelo contato do DPO.
                </P>
              </Section>

              <Section id="seguranca" title="8. Segurança dos Dados">
                <P>Adotamos medidas técnicas e administrativas para proteger os dados pessoais contra acesso não autorizado, perda, alteração ou destruição:</P>
                <ul className="space-y-1 ml-1">
                  <Li>Autenticação segura via Firebase Authentication (senhas com hash bcrypt)</Li>
                  <Li>Comunicação criptografada via HTTPS/TLS em todas as rotas</Li>
                  <Li>Regras de acesso no Firestore: cada nutricionista acessa apenas seus próprios dados</Li>
                  <Li>Timeout de sessão automático após 15 minutos de inatividade</Li>
                  <Li>Tokens de acesso do paciente gerados com entropia criptográfica</Li>
                  <Li>Controle de taxa de requisições (rate limiting) nas APIs</Li>
                  <Li>Acesso administrativo restrito a e-mails autorizados explicitamente</Li>
                </ul>
                <P>
                  Em caso de incidente de segurança que possa acarretar risco ou dano relevante aos titulares,
                  notificaremos a ANPD e os afetados nos prazos legais (Art. 48 LGPD).
                </P>
              </Section>

              <Section id="direitos" title="9. Seus Direitos (LGPD Art. 18)">
                <P>
                  Como titular de dados pessoais, você possui os seguintes direitos garantidos pelo Art. 18 da LGPD,
                  exercíveis a qualquer momento:
                </P>
                <Table
                  headers={['Direito', 'Descrição', 'Como exercer']}
                  rows={[
                    ['Confirmação e Acesso (Art. 18, I-II)', 'Saber se tratamos seus dados e obter cópia', 'E-mail para privacidade@nutrir.app'],
                    ['Correção (Art. 18, III)', 'Corrigir dados incompletos, inexatos ou desatualizados', 'Configurações da conta ou e-mail'],
                    ['Anonimização / Bloqueio / Exclusão (Art. 18, IV)', 'Solicitar exclusão de dados desnecessários ou excessivos', 'E-mail para privacidade@nutrir.app'],
                    ['Portabilidade (Art. 18, V)', 'Receber seus dados em formato estruturado e interoperável', 'E-mail para privacidade@nutrir.app'],
                    ['Exclusão (Art. 18, VI)', 'Solicitar exclusão dos dados tratados com consentimento', 'E-mail ou exclusão de conta'],
                    ['Informação sobre compartilhamento (Art. 18, VII)', 'Saber com quais terceiros compartilhamos seus dados', 'Seção 6 desta política'],
                    ['Revogação do consentimento (Art. 18, IX)', 'Retirar consentimento para tratamentos baseados nele', 'Configurações > Privacidade'],
                    ['Oposição (Art. 18, §2º)', 'Opor-se a tratamento que viole a LGPD', 'E-mail para privacidade@nutrir.app'],
                  ]}
                />
                <P>
                  Responderemos às solicitações em até <strong className="text-foreground">15 dias úteis</strong>. Em casos complexos,
                  esse prazo pode ser estendido por igual período, mediante comunicação ao titular.
                </P>
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-xs text-blue-800 dark:text-blue-200">
                  ℹ️ Você também pode apresentar reclamação diretamente à Autoridade Nacional de Proteção de Dados (ANPD)
                  em <a href="https://www.gov.br/anpd" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80">www.gov.br/anpd</a>.
                </div>
              </Section>

              <Section id="cookies" title="10. Cookies e Rastreamento">
                <P>
                  Utilizamos cookies e armazenamento local (localStorage) para funcionamento e, com seu consentimento, para análise de uso.
                  Consulte nossa <a href="/cookies" className="text-primary hover:underline">Política de Cookies</a> para detalhes completos.
                  Você pode gerenciar suas preferências em <a href="/settings?tab=privacy" className="text-primary hover:underline">Configurações &gt; Privacidade</a>.
                </P>
                <Table
                  headers={['Tipo', 'Finalidade', 'Consentimento']}
                  rows={[
                    ['Essenciais (localStorage)', 'Sessão de autenticação, timeout de segurança', 'Não necessário'],
                    ['Analíticos (Axiom)', 'Logs de uso para diagnóstico e melhoria do serviço', 'Necessário — pode ser revogado'],
                  ]}
                />
              </Section>

              <Section id="menores" title="11. Menores de Idade">
                <P>
                  A plataforma Nutrir é destinada exclusivamente a nutricionistas registrados no CFN e a seus pacientes maiores de 18 anos,
                  ou menores com responsável legal devidamente identificado.
                  Não coletamos intencionalmente dados de menores de 13 anos sem consentimento dos pais ou responsáveis (Art. 14 LGPD).
                  Caso identifiquemos coleta inadvertida, os dados serão excluídos imediatamente.
                </P>
              </Section>

              <Section id="alteracoes" title="12. Alterações desta Política">
                <P>
                  Podemos atualizar esta Política periodicamente para refletir mudanças em nossas práticas, no serviço ou na legislação.
                  Alterações significativas serão comunicadas por e-mail e/ou aviso destacado na plataforma com antecedência mínima de
                  <strong className="text-foreground"> 30 dias</strong>.
                  O uso contínuo da plataforma após o prazo de comunicação implica aceite da política atualizada.
                </P>
                <P>
                  O histórico de versões desta política está disponível mediante solicitação ao DPO.
                </P>
              </Section>

              <Section id="contato" title="13. Contato e DPO">
                <P>
                  Para exercer seus direitos, esclarecer dúvidas ou reportar incidentes relacionados à privacidade,
                  entre em contato com nosso Encarregado de Proteção de Dados (DPO):
                </P>
                <div className="bg-muted/30 rounded-lg p-4 text-sm space-y-2">
                  <p><span className="font-semibold text-foreground">E-mail:</span>{' '}
                    <a href="mailto:privacidade@nutrir.app" className="text-primary hover:underline">privacidade@nutrir.app</a>
                  </p>
                  <p><span className="font-semibold text-foreground">Prazo de resposta:</span>{' '}
                    <span className="text-muted-foreground">Até 15 dias úteis</span>
                  </p>
                  <p><span className="font-semibold text-foreground">Idioma:</span>{' '}
                    <span className="text-muted-foreground">Português (BR)</span>
                  </p>
                </div>
                <P>
                  Esta política é regida pelas leis da República Federativa do Brasil.
                  O foro competente para dirimir quaisquer disputas é o da Comarca de São Paulo — SP.
                </P>
              </Section>

            </div>
          </div>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
