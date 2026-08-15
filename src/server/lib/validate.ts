import type { ZodType } from 'zod';

/**
 * Valida req.body contra um schema Zod. Em caso de falha, já escreve a resposta 400
 * e retorna undefined — o caller só precisa checar `if (!body) return;`.
 * Como schemas Zod descartam chaves não declaradas por padrão, isso também impede
 * mass assignment de campos como id/nutritionistId/accessToken vindos do cliente.
 */
export function validateBody<T>(schema: ZodType<T>, req: any, res: any): T | undefined {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({
      error: 'Dados inválidos.',
      details: result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
    return undefined;
  }
  return result.data;
}

/**
 * Mesma ideia de validateBody, mas para req.query (ex.: date range de gráficos).
 * Em caso de falha já escreve a resposta 400 e retorna undefined.
 */
export function validateQuery<T>(schema: ZodType<T>, req: any, res: any): T | undefined {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    res.status(400).json({
      error: 'Parâmetros inválidos.',
      details: result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
    return undefined;
  }
  return result.data;
}
