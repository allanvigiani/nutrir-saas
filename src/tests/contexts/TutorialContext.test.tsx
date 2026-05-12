// @vitest-environment jsdom
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';

vi.mock('../../lib/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn().mockReturnValue({ id: 'mock-doc-ref' }),
  updateDoc: vi.fn().mockResolvedValue(undefined),
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

import { updateDoc } from 'firebase/firestore';
import { TutorialProvider, useTutorial } from '../../contexts/TutorialContext';

const mockUpdateDoc = vi.mocked(updateDoc);

function wrapper({ children }: { children: React.ReactNode }) {
  return <TutorialProvider>{children}</TutorialProvider>;
}

describe('TutorialContext — API manual', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateDoc.mockResolvedValue(undefined);
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

  it('closeTutorial não chama updateDoc (flag já foi salva no auto-trigger)', () => {
    const { result } = renderHook(() => useTutorial(), { wrapper });
    act(() => result.current.closeTutorial());
    expect(mockUpdateDoc).not.toHaveBeenCalled();
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
    mockUpdateDoc.mockResolvedValue(undefined);
    mockIsAuthReady = true;
  });

  it('abre e salva hasSeenTutorial quando campo é undefined', async () => {
    mockNutritionist.hasSeenTutorial = undefined;
    const { result } = renderHook(() => useTutorial(), { wrapper });
    await act(async () => {});
    expect(result.current.isOpen).toBe(true);
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ hasSeenTutorial: true }),
    );
  });

  it('não abre quando hasSeenTutorial é true', async () => {
    mockNutritionist.hasSeenTutorial = true;
    const { result } = renderHook(() => useTutorial(), { wrapper });
    await act(async () => {});
    expect(result.current.isOpen).toBe(false);
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });
});
