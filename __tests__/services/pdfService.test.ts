// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { compileToPdf, downloadBlob } from '../../services/pdfService';

// ── compileToPdf ──────────────────────────────────────────────────────────────

describe('compileToPdf', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns a Blob on success', async () => {
    const mockBlob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(mockBlob, { status: 200 })
    );

    const result = await compileToPdf('\\documentclass{article}');
    expect(result.constructor.name).toBe('Blob');
    expect(result.size).toBeGreaterThan(0);
  });

  it('posts to the correct URL with JSON body', async () => {
    const mockBlob = new Blob(['%PDF'], { type: 'application/pdf' });
    vi.mocked(fetch).mockResolvedValueOnce(new Response(mockBlob, { status: 200 }));

    await compileToPdf('\\documentclass{article}', { data: 'abc', extension: 'jpg' });

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3001/compile',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
    expect(body.latex).toBe('\\documentclass{article}');
    expect(body.photoData).toEqual({ data: 'abc', extension: 'jpg' });
  });

  it('sets photoData to null when no photoData argument is provided', async () => {
    const mockBlob = new Blob(['%PDF'], { type: 'application/pdf' });
    vi.mocked(fetch).mockResolvedValueOnce(new Response(mockBlob, { status: 200 }));

    await compileToPdf('\\documentclass{article}');

    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
    expect(body.photoData).toBeNull();
  });

  it('throws on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('Bad LaTeX', { status: 500 })
    );

    await expect(compileToPdf('bad latex')).rejects.toThrow('Erreur de compilation LaTeX: 500');
  });

  it('throws on network error', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(compileToPdf('\\documentclass{article}')).rejects.toThrow('Failed to fetch');
  });
});

// ── downloadBlob ──────────────────────────────────────────────────────────────

describe('downloadBlob', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:http://localhost/fake-url'),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('creates an anchor element with the correct href and download attributes', () => {
    const blob = new Blob(['data'], { type: 'application/pdf' });
    const appendSpy = vi.spyOn(document.body, 'appendChild');

    downloadBlob(blob, 'cv.pdf');

    const anchor = appendSpy.mock.calls[0][0] as HTMLAnchorElement;
    expect(anchor.tagName).toBe('A');
    expect(anchor.href).toContain('fake-url');
    expect(anchor.download).toBe('cv.pdf');
  });

  it('calls URL.createObjectURL with the blob', () => {
    const blob = new Blob(['data'], { type: 'application/pdf' });
    downloadBlob(blob, 'cv.pdf');
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
  });

  it('calls URL.revokeObjectURL after the click', () => {
    const blob = new Blob(['data'], { type: 'application/pdf' });
    downloadBlob(blob, 'cv.pdf');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/fake-url');
  });

  it('removes the anchor from the DOM after the click', () => {
    const blob = new Blob(['data'], { type: 'application/pdf' });
    downloadBlob(blob, 'cv.pdf');
    expect(document.body.querySelector('a')).toBeNull();
  });
});
