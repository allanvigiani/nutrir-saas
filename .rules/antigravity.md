# Regras de Desenvolvimento - Nutrir SaaS

Este documento define os padrões arquiteturais, linguagens e convenções de código que o Antigravity deve seguir ao trabalhar no projeto Nutrir SaaS.

## 🚀 Tecnologias Principais

- **Frontend**: React 19, Vite, Tailwind CSS 4, React Router 7.
- **Backend**: Node.js, Express 4, `tsx` para execução.
- **Banco de Dados/Auth**: Firebase (Firestore & Firebase Auth).
- **Estilização**: Tailwind CSS com Shadcn UI e Framer Motion.
- **Formulários**: React Hook Form + Zod.
- **Testes**: Vitest.
- **Idioma**: O código usa **Português (PT-BR)** para termos de negócio, comentários e interface com o usuário.

---

## 🏛️ Arquitetura do Backend (src/server)

O backend segue um padrão funcional com Injeção de Dependências via factory functions.

### 1. Estrutura de Camadas
- **Routes**: Define os endpoints e injeta as dependências necessárias.
- **Controllers**: Lida com o ciclo de vida do Express (Request/Response), validação de entrada e chama os serviços.
- **Services**: Contém a lógica de negócio pura. Devem ser, preferencialmente, fáceis de testar sem mocks complexos.

### 2. Padrão Factory (Dependency Injection)
Sempre utilize factory functions para criar instâncias de serviços e controllers.

```typescript
// Exemplo de Service
export function createMyService() {
  function executeBusinessLogic(data: any) { ... }
  return { executeBusinessLogic };
}

// Exemplo de Controller
export function createMyController({ myService }: { myService: ReturnType<typeof createMyService> }) {
  async function handleRequest(req: Request, res: Response) {
    try {
      const result = myService.executeBusinessLogic(req.body);
      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({ error: "Erro interno" });
    }
  }
  return { handleRequest };
}
```

---

## 💻 Padrões de Frontend (src)

### 1. Componentes e Estilização
- Utilize **Tailwind CSS** para toda a estilização.
- Use a utilidade `cn` (`src/lib/utils.ts`) para combinação condicional de classes.
- Priorize componentes do **Shadcn UI** localizados em `src/components/ui`.
- Ícones devem vir de `lucide-react`.

### 2. Integração com Firebase
- Consultas ao Firestore são feitas frequentemente direto nos componentes/hooks usando `onSnapshot` para tempo real.
- Sempre limpe os listeners (`unsubscribe`) em `useEffect`.

### 3. Gerenciamento de Datas
- Use `date-fns` com o locale `ptBR`.

---

## 🧪 Padrões de Teste (src/tests)

- Use **Vitest**.
- Mantenha uma cobertura rigorosa para os **Services** de lógica de negócio (ex: `nutrition.service.ts`).
- Organize os testes com `describe` e `it` em português ou inglês (siga o padrão do arquivo existente).
- Utilize helpers para gerar inputs base e facilitar os testes.

---

## 📝 Convenções de Escrita

- **Nomes de Arquivos**: `kebab-case` para componentes e utilitários (`patient-profile.tsx`), `camelCase` ou `kebab-case` dependendo do contexto.
- **Idioma**:
    - Variáveis de negócio: `peso`, `altura`, `paciente` (Português).
    - Variáveis técnicas: `req`, `res`, `loading`, `data` (Inglês).
    - Comentários: Português.
- **Tipagem**: TypeScript Estrito. Defina interfaces para todos os payloads e retornos.

---

## ⚠️ Observações Importantes

- O arquivo `PatientProfile.tsx` é o core da aplicação e possui alta complexidade. Edições nele devem ser feitas com cautela extra.
- Sempre verifique se o usuário é Premium antes de liberar certas funcionalidades (use o componente `PremiumFeature` ou a flag `isPremium`).
