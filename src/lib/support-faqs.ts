export interface Faq {
  question: string;
  answer: string;
}

export interface FaqModule {
  id: string;
  emoji: string;
  label: string;
  faqs: Faq[];
}

export const appFaqs: FaqModule[] = [
  {
    id: 'pacientes',
    emoji: '👥',
    label: 'Pacientes',
    faqs: [
      {
        question: 'Como cadastrar um novo paciente?',
        answer: 'Acesse o menu Pacientes, clique em Novo Paciente, preencha os dados e salve. Simples assim! 😊',
      },
      {
        question: 'Como desativar um paciente?',
        answer: 'No perfil do paciente, abra o menu de opções e selecione Desativar. Fique tranquilo — todos os dados ficam preservados para auditoria.',
      },
      {
        question: 'O paciente pode acessar seus dados?',
        answer: 'Sim! Gere o link de acesso no perfil do paciente e compartilhe com ele. Pelo link, ele consegue visualizar consultas e planos alimentares.',
      },
      {
        question: 'Como exportar os dados do paciente?',
        answer: 'No perfil do paciente, abra o menu de opções e selecione Exportar dados. Essa funcionalidade está disponível no plano Premium.',
      },
    ],
  },
  {
    id: 'consultas',
    emoji: '📋',
    label: 'Consultas',
    faqs: [
      {
        question: 'Como registrar uma nova consulta?',
        answer: 'Abra o perfil do paciente, vá até a aba Consultas e clique em Nova Consulta. Preencha os dados clínicos e salve.',
      },
      {
        question: 'Quantas consultas posso fazer no plano gratuito?',
        answer: 'No plano gratuito você pode realizar até 4 consultas por mês no total, com limite de 1 consulta por paciente por mês.',
      },
      {
        question: 'Posso editar uma consulta já salva?',
        answer: 'Sim! Clique na consulta e use o ícone de edição. Todas as alterações ficam registradas no histórico.',
      },
    ],
  },
  {
    id: 'planos-alimentares',
    emoji: '🥗',
    label: 'Planos alimentares',
    faqs: [
      {
        question: 'Como criar um plano alimentar?',
        answer: 'No perfil do paciente, acesse a aba Planos Alimentares e clique em Novo Plano. A partir daí você adiciona as refeições e os alimentos de cada uma.',
      },
      {
        question: 'Posso duplicar um plano alimentar?',
        answer: 'Sim, dentro do mesmo paciente. A cópia entre pacientes ainda não está disponível, mas está no nosso roadmap!',
      },
      {
        question: 'O paciente consegue ver o plano?',
        answer: 'Sim, pelo link de acesso do paciente. Basta gerar e compartilhar com ele.',
      },
    ],
  },
  {
    id: 'exames',
    emoji: '🧪',
    label: 'Exames laboratoriais',
    faqs: [
      {
        question: 'Como adicionar um exame?',
        answer: 'No perfil do paciente, vá até a aba Exames e clique em Novo Exame. Insira os marcadores e os valores correspondentes.',
      },
      {
        question: 'Posso anexar o arquivo do exame?',
        answer: 'Sim! No campo Relatório, ao criar ou editar o exame, você pode fazer o upload do arquivo.',
      },
      {
        question: 'Quantos exames posso cadastrar no plano gratuito?',
        answer: 'No plano gratuito o limite é de 2 exames por paciente.',
      },
    ],
  },
  {
    id: 'agendamentos',
    emoji: '📅',
    label: 'Agendamentos',
    faqs: [
      {
        question: 'Como criar um agendamento?',
        answer: 'Acesse o menu Agenda, clique em Novo Agendamento, selecione o paciente e escolha a data e horário.',
      },
      {
        question: 'Como conectar ao Google Calendar?',
        answer: 'Em Configurações, acesse a aba Integrações e clique em Conectar no Google Calendar. Siga os passos de autorização e pronto!',
      },
      {
        question: 'Como cancelar um agendamento?',
        answer: 'Na agenda, clique sobre o agendamento desejado e selecione a opção Cancelar.',
      },
    ],
  },
  {
    id: 'financeiro',
    emoji: '💰',
    label: 'Financeiro',
    faqs: [
      {
        question: 'Como registrar um pagamento?',
        answer: 'Acesse o menu Financeiro e clique em Novo Pagamento. Selecione o paciente, informe o valor, a data e o método de pagamento.',
      },
      {
        question: 'Consigo filtrar pagamentos por período?',
        answer: 'Sim! Use os filtros de data que ficam no topo da lista de pagamentos.',
      },
      {
        question: 'Como exportar o relatório financeiro?',
        answer: 'No menu Financeiro, use o ícone de exportação no topo da lista. Essa funcionalidade está disponível no plano Premium.',
      },
    ],
  },
  {
    id: 'assinatura',
    emoji: '💳',
    label: 'Assinatura',
    faqs: [
      {
        question: 'Qual a diferença entre o plano gratuito e o Premium?',
        answer: 'O plano gratuito permite até 5 pacientes ativos e tem limites por módulo. Já o Premium oferece pacientes e funcionalidades ilimitados, sem restrições.',
      },
      {
        question: 'Como fazer upgrade para o Premium?',
        answer: 'Acesse Configurações, vá até a aba Assinatura e clique em Assinar Premium. O processo é rápido e simples.',
      },
      {
        question: 'Como cancelar minha assinatura?',
        answer: 'Em Configurações, acesse Assinatura e clique em Cancelar plano. Você mantém o acesso ao Premium até o fim do período já pago.',
      },
      {
        question: 'Quais formas de pagamento são aceitas?',
        answer: 'Aceitamos cartão de crédito e PIX, processados com segurança pela plataforma Asaas.',
      },
    ],
  },
];

export const landingFaqs: FaqModule[] = [
  {
    id: 'como-funciona',
    emoji: '🚀',
    label: 'Como funciona',
    faqs: [
      {
        question: 'O que é o Nutrir?',
        answer: 'O Nutrir é uma plataforma completa de gestão para nutricionistas. Em um só lugar você gerencia pacientes, consultas, planos alimentares, exames, agenda e financeiro.',
      },
      {
        question: 'Preciso instalar algum programa?',
        answer: 'Não! O Nutrir funciona 100% no navegador, em qualquer dispositivo — computador, tablet ou celular.',
      },
      {
        question: 'Existe período de teste gratuito?',
        answer: 'Sim! O plano gratuito é permanente e não exige cartão de crédito. Você pode usar sem limite de tempo e fazer upgrade quando quiser.',
      },
    ],
  },
  {
    id: 'planos-precos',
    emoji: '💰',
    label: 'Planos e preços',
    faqs: [
      {
        question: 'Quanto custa o plano Premium?',
        answer: 'Acesse nossa página de planos para ver o valor atualizado e todas as condições. Temos opções mensais e anuais.',
      },
      {
        question: 'Posso mudar de plano a qualquer momento?',
        answer: 'Sim! Tanto o upgrade quanto o downgrade estão disponíveis diretamente nas configurações da sua conta.',
      },
      {
        question: 'O que está incluído no plano gratuito?',
        answer: 'O plano gratuito permite até 5 pacientes ativos e acesso às funcionalidades essenciais, com alguns limites por módulo.',
      },
      {
        question: 'Quais formas de pagamento são aceitas?',
        answer: 'Aceitamos cartão de crédito e PIX.',
      },
    ],
  },
  {
    id: 'seguranca',
    emoji: '🔒',
    label: 'Segurança e LGPD',
    faqs: [
      {
        question: 'Os dados dos pacientes são seguros?',
        answer: 'Com certeza! Todos os dados sensíveis são criptografados, armazenados em nuvem com backups automáticos e tratados em conformidade com a LGPD.',
      },
      {
        question: 'Posso exportar ou apagar todos os meus dados?',
        answer: 'Sim. Em Configurações, na aba Conta, você pode exportar todos os seus dados ou solicitar a exclusão completa da conta a qualquer momento.',
      },
    ],
  },
  {
    id: 'duvidas-gerais',
    emoji: '❓',
    label: 'Dúvidas gerais',
    faqs: [
      {
        question: 'Consigo usar em celular ou tablet?',
        answer: 'Sim! O Nutrir é totalmente responsivo e se adapta a qualquer tamanho de tela.',
      },
      {
        question: 'Posso ter mais de um nutricionista na mesma conta?',
        answer: 'Não, cada conta é individual por nutricionista. Para múltiplos profissionais, cada um deve ter seu próprio cadastro.',
      },
      {
        question: 'Como falo com o suporte?',
        answer: 'Você pode nos contatar pelo WhatsApp (+55 21 97185-6414) ou por e-mail em contato.nutrirgestao@gmail.com. Respondemos o mais rápido possível!',
      },
    ],
  },
];
