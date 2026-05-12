// @vitest-environment jsdom
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

const mockCloseTutorial = vi.fn();
const mockOpenTutorial = vi.fn();

vi.mock('../../contexts/TutorialContext', () => ({
  useTutorial: () => ({
    isOpen: true,
    openTutorial: mockOpenTutorial,
    closeTutorial: mockCloseTutorial,
  }),
}));

vi.mock('../../components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { TutorialModal } from '../../components/TutorialModal';

describe('TutorialModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renderiza o passo 1 inicialmente', () => {
    render(<TutorialModal />);
    expect(screen.getByText(/passo 1 de 12/i)).toBeInTheDocument();
  });

  it('botão Voltar está desabilitado no passo 1', () => {
    render(<TutorialModal />);
    expect(screen.getByRole('button', { name: /voltar/i })).toBeDisabled();
  });

  it('botão Próximo avança para o passo 2', () => {
    render(<TutorialModal />);
    fireEvent.click(screen.getByRole('button', { name: /próximo/i }));
    expect(screen.getByText(/passo 2 de 12/i)).toBeInTheDocument();
  });

  it('botão Fechar chama closeTutorial', () => {
    render(<TutorialModal />);
    fireEvent.click(screen.getByRole('button', { name: /fechar/i }));
    expect(mockCloseTutorial).toHaveBeenCalledOnce();
  });

  it('no passo 12 o botão Próximo vira Concluir', () => {
    render(<TutorialModal />);
    for (let i = 0; i < 11; i++) {
      fireEvent.click(screen.getByRole('button', { name: /próximo/i }));
    }
    expect(screen.getByRole('button', { name: /concluir/i })).toBeInTheDocument();
  });

  it('clicar em Concluir no último passo chama closeTutorial', () => {
    render(<TutorialModal />);
    for (let i = 0; i < 11; i++) {
      fireEvent.click(screen.getByRole('button', { name: /próximo/i }));
    }
    fireEvent.click(screen.getByRole('button', { name: /concluir/i }));
    expect(mockCloseTutorial).toHaveBeenCalledOnce();
  });
});
