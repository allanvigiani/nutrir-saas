import nodemailer from 'nodemailer';

// Criado sob demanda para garantir que dotenv já foi carregado
function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

// Mantido para compatibilidade com `export default transporter`
const transporter = { sendMail: (...args: any[]) => getTransporter().sendMail(...args) } as any;

interface SendEmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: any[];
}

/**
 * Função utilitária para enviar e-mails
 */
export async function sendEmail({ to, subject, text, html, attachments }: SendEmailOptions) {
  try {
    const info = await getTransporter().sendMail({
      from: process.env.SMTP_FROM || '',
      to,
      subject,
      text,
      html,
      attachments
    });

    console.log('[Email] Mensagem enviada: %s', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[Email] Erro ao enviar e-mail:', error);
    throw error;
  }
}

/**
 * Template de e-mail de boas-vindas para o paciente
 */
export function getPatientWelcomeTemplate(patientName: string, nutritionistName: string, nutritionistEmail: string, nutritionistPhone?: string) {
  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb; border-radius: 16px; overflow: hidden; border: 1px solid #e5e7eb;">
      <div style="background-color: #059669; padding: 40px 20px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px; letter-spacing: -0.025em;">Bem-vindo ao Nutrir!</h1>
      </div>
      
      <div style="padding: 40px 30px; background-color: white;">
        <p style="font-size: 18px; color: #111827; margin-bottom: 24px;">Olá, <strong>${patientName}</strong>!</p>
        
        <p style="font-size: 16px; color: #4b5563; line-height: 1.6; margin-bottom: 32px;">
          É com muita alegria que informamos que seu perfil foi criado com sucesso no sistema <strong>Nutrir</strong>. 
          A partir de agora, você terá um acompanhamento nutricional moderno e eficiente.
        </p>
        
        <div style="background-color: #f3f4f6; border-radius: 12px; padding: 24px; margin-bottom: 32px;">
          <h2 style="font-size: 14px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 16px 0;">Seu Nutricionista Responsável</h2>
          
          <div style="display: flex; align-items: center;">
            <div style="flex: 1;">
              <p style="font-size: 18px; font-weight: bold; color: #111827; margin: 0 0 4px 0;">${nutritionistName}</p>
              <p style="font-size: 14px; color: #4b5563; margin: 0 0 4px 0;">${nutritionistEmail}</p>
              ${nutritionistPhone ? `<p style="font-size: 14px; color: #4b5563; margin: 0;">${nutritionistPhone}</p>` : ''}
            </div>
          </div>
        </div>
        
        <p style="font-size: 16px; color: #4b5563; line-height: 1.6; margin-bottom: 0;">
          Em breve, você receberá mais informações sobre seus planos alimentares e consultas. 
          Estamos ansiosos para fazer parte da sua jornada rumo a uma vida mais saudável!
        </p>
      </div>
      
      <div style="padding: 24px; text-align: center; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
        <p style="font-size: 12px; color: #9ca3af; margin: 0;">
          &copy; ${new Date().getFullYear()} Nutrir - Gestão Nutricional Inteligente.
        </p>
      </div>
    </div>
  `;
}

/**
 * Template de e-mail de boas-vindas ao Plano Premium para o nutricionista
 */
export function getPremiumWelcomeTemplate(nutritionistName: string) {
  const appUrl = process.env.APP_URL || '';
  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb; border-radius: 16px; overflow: hidden; border: 1px solid #e5e7eb;">
      <div style="background-color: #065f46; padding: 40px 20px; text-align: center;">
        <div style="background-color: #34d399; width: 60px; height: 60px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
          <span style="font-size: 30px;">💎</span>
        </div>
        <h1 style="color: white; margin: 0; font-size: 28px; letter-spacing: -0.025em;">Você agora é Premium!</h1>
      </div>
      
      <div style="padding: 40px 30px; background-color: white;">
        <p style="font-size: 18px; color: #111827; margin-bottom: 24px;">Olá, <strong>${nutritionistName}</strong>!</p>
        
        <p style="font-size: 16px; color: #4b5563; line-height: 1.6; margin-bottom: 32px;">
          Seu pagamento foi confirmado e sua assinatura do <strong>Plano Premium Nutrir</strong> já está ativa! 
          Agora você tem acesso ilimitado a todos os recursos para elevar o nível do seu atendimento.
        </p>
        
        <div style="background-color: #ecfdf5; border-radius: 12px; padding: 24px; margin-bottom: 32px; border: 1px solid #d1fae5;">
          <h2 style="font-size: 14px; color: #065f46; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 16px 0; font-weight: bold;">O que você liberou agora:</h2>
          
          <ul style="margin: 0; padding: 0; list-style: none;">
            <li style="margin-bottom: 12px; display: flex; align-items: center; font-size: 15px; color: #065f46;">
              <span style="margin-right: 10px;">✅</span> Pacientes ilimitados
            </li>
            <li style="margin-bottom: 12px; display: flex; align-items: center; font-size: 15px; color: #065f46;">
              <span style="margin-right: 10px;">✅</span> Planos alimentares sem restrições
            </li>
            <li style="margin-bottom: 12px; display: flex; align-items: center; font-size: 15px; color: #065f46;">
              <span style="margin-right: 10px;">✅</span> Histórico completo de consultas
            </li>
            <li style="display: flex; align-items: center; font-size: 15px; color: #065f46;">
              <span style="margin-right: 10px;">✅</span> Suporte prioritário
            </li>
          </ul>
        </div>
        
        <div style="text-align: center;">
          <a href="${appUrl}" style="background-color: #059669; color: white; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">Acessar meu Painel</a>
        </div>
      </div>
      
      <div style="padding: 24px; text-align: center; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
        <p style="font-size: 12px; color: #9ca3af; margin: 0;">
          Obrigado por confiar no Nutrir para gerir sua carreira.<br>
          &copy; ${new Date().getFullYear()} Nutrir - Gestão Nutricional Inteligente.
        </p>
      </div>
    </div>
  `;
}

/**
 * Template de e-mail para envio de Plano Alimentar
 */
export function getMealPlanEmailTemplate(patientName: string, nutritionistName: string) {
  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb; border-radius: 16px; overflow: hidden; border: 1px solid #e5e7eb;">
      <div style="background-color: #059669; padding: 40px 20px; text-align: center;">
        <div style="background-color: #ffffff; width: 60px; height: 60px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
          <span style="font-size: 30px;">🥗</span>
        </div>
        <h1 style="color: white; margin: 0; font-size: 24px; letter-spacing: -0.025em;">Seu Plano Alimentar Chegou!</h1>
      </div>

      <div style="padding: 40px 30px; background-color: white;">
        <p style="font-size: 18px; color: #111827; margin-bottom: 24px;">Olá, <strong>${patientName}</strong>!</p>

        <p style="font-size: 16px; color: #4b5563; line-height: 1.6; margin-bottom: 32px;">
          Seu nutricionista, <strong>${nutritionistName}</strong>, acaba de enviar o seu novo plano alimentar personalizado.
          O arquivo PDF está em anexo a este e-mail.
        </p>

        <div style="background-color: #f0fdf4; border-radius: 12px; padding: 24px; margin-bottom: 32px; border: 1px solid #dcfce7;">
          <p style="font-size: 15px; color: #166534; margin: 0;">
            💡 <strong>Dica:</strong> Salve este PDF no seu celular para ter fácil acesso às suas refeições e orientações a qualquer momento.
          </p>
        </div>

        <p style="font-size: 14px; color: #6b7280; line-height: 1.6;">
          Se tiver qualquer dúvida sobre as substituições ou quantidades, entre em contato diretamente com seu nutricionista.
        </p>
      </div>

      <div style="padding: 24px; text-align: center; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
        <p style="font-size: 12px; color: #9ca3af; margin: 0;">
          Enviado via <strong>Nutrir</strong> - Gestão Nutricional Inteligente.<br>
          &copy; ${new Date().getFullYear()} Nutrir.
        </p>
      </div>
    </div>
  `;
}

/**
 * Template de e-mail para redefinição de senha
 */
export function getPasswordResetTemplate(resetLink: string): string {
  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb; border-radius: 16px; overflow: hidden; border: 1px solid #e5e7eb;">
      <div style="background-color: #059669; padding: 40px 20px; text-align: center;">
        <div style="background-color: #ffffff; width: 64px; height: 64px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
          <span style="font-size: 32px; line-height: 1;">🔐</span>
        </div>
        <h1 style="color: white; margin: 0 0 4px; font-size: 22px; font-weight: 700; letter-spacing: -0.025em;">Redefinição de senha</h1>
        <p style="color: rgba(255,255,255,0.8); margin: 0; font-size: 14px;">Nutrir · Gestão Nutricional</p>
      </div>

      <div style="padding: 40px 32px; background-color: #ffffff;">
        <p style="font-size: 16px; color: #111827; margin: 0 0 16px;">Olá!</p>
        <p style="font-size: 15px; color: #4b5563; line-height: 1.7; margin: 0 0 32px;">
          Recebemos uma solicitação para redefinir a senha da sua conta no <strong>Nutrir</strong>.
          Clique no botão abaixo para criar uma nova senha:
        </p>

        <div style="text-align: center; margin-bottom: 32px;">
          <a href="${resetLink}" style="display: inline-block; background-color: #059669; color: #ffffff; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 36px; border-radius: 4px; letter-spacing: 0.01em;">
            Redefinir minha senha
          </a>
        </div>

        <div style="background-color: #fffbeb; border-radius: 10px; padding: 16px 20px; margin-bottom: 28px; border: 1px solid #fde68a;">
          <p style="font-size: 13px; color: #92400e; margin: 0; line-height: 1.6;">
            ⚠️ <strong>Este link expira em 1 hora.</strong> Após esse prazo, será necessário solicitar um novo link de redefinição.
          </p>
        </div>

        <div style="border-top: 1px solid #f3f4f6; padding-top: 24px;">
          <p style="font-size: 13px; color: #9ca3af; line-height: 1.6; margin: 0;">
            Se você não solicitou a redefinição de senha, ignore este e-mail com segurança.
            Sua senha permanece a mesma e nenhuma alteração foi feita na sua conta.
          </p>
        </div>
      </div>

      <div style="padding: 20px 32px; text-align: center; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
        <p style="font-size: 12px; color: #9ca3af; margin: 0; line-height: 1.6;">
          Enviado via <strong style="color: #6b7280;">Nutrir</strong> · Gestão Nutricional Inteligente<br>
          &copy; ${new Date().getFullYear()} Nutrir. Todos os direitos reservados.
        </p>
      </div>
    </div>
  `;
}

export default transporter;
