// @vitest-environment jsdom
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';

// Mock apiRequest used by TutorialContext
const mockApiRequest = vi.fn().mockResolvedValue(undefined);
vi.mock('../../hooks/useApi', () => ({
  apiRequest: (...args: any[]) => mockApiRequest(...args),
  useApi: vi.fn(),
}));

const mockNutritionist = { id: 'user-123', name: 'Test', hasSeenTutorial: undefined as boolean | undefined };
let mockIsAuthReady = true;

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'user-123' },
    nutritionist: mockNutritionist.id ? mockNutritionist : null,
    isAuthReady: mockIsAuthReady,
  }),
}));

import { TutorialProvider, useTutorial } from '../../contexts/TutorialContext';

function wrapper({ children }: { children: React.ReactNode }) {
  return <TutorialProvider>{children}</TutorialProvider>;
}

describe('TutorialContext — API manual', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiRequest.mockResolvedValue(undefined);
    mockNutritionist.hasSeenTutorial = true; // evita auto-trigger nos testes manuais
    mockIsAuthReady = true;
  });

  it('openTutorial seta isOpen para true', () => {
    const { result } = renderHook(() => useTutorial(), { wrapper });
    act(() => result.current.openTutorial());
    expect(result.current.isOpen).toBe(true);
  });

  it('closeTutorial seta isOpen para false', () => {
    const { result } = renderHook(() => useTutorial(), { wrapper });
    act(() => result.current.openTutorial());
    act(() => result.current.closeTutorial());
    expect(result.current.isOpen).toBe(false);
  });

  it('closeTutorial não chama apiRequest (flag já foi salva no auto-trigger)', () => {
    const { result } = renderHook(() => useTutorial(), { wrapper });
    act(() => result.current.closeTutorial());
    expect(mockApiRequest).not.toHaveBeenCalled();
  });

  it('useTutorial lança erro fora do provider', () => {
    expect(() => renderHook(() => useTutorial())).toThrow(
      'useTutorial must be used within TutorialProvider',
    );
  });
});

describe('TutorialContext — auto-trigger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiRequest.mockResolvedValue(undefined);
    mockIsAuthReady = true;
  });

  it('abre e salva hasSeenTutorial quando campo é undefined', async () => {
    mockNutritionist.hasSeenTutorial = undefined;
    const { result } = renderHook(() => useTutorial(), { wrapper });
    await act(async () => {});
    expect(result.current.isOpen).toBe(true);
    expect(mockApiRequest).toHaveBeenCalledWith(
      '/api/me',
      'PATCH',
      expect.objectContaining({ hasSeenTutorial: true }),
    );
  });

  it('não abre quando hasSeenTutorial é true', async () => {
    mockNutritionist.hasSeenTutorial = true;
    const { result } = renderHook(() => useTutorial(), { wrapper });
    await act(async () => {});
    expect(result.current.isOpen).toBe(false);
    expect(mockApiRequest).not.toHaveBeenCalled();
  });
});
