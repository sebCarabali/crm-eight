import { stripRewriteParams } from './vercel';

describe('stripRewriteParams (rewrites de Vercel)', () => {
  it('quita el parámetro path que agrega el rewrite', () => {
    expect(stripRewriteParams('/api/sales?from=2026-11-01T05%3A00%3A00.000Z&path=sales')).toBe(
      '/api/sales?from=2026-11-01T05%3A00%3A00.000Z',
    );
    expect(stripRewriteParams('/api/products/summary?path=products%2Fsummary')).toBe('/api/products/summary');
  });

  it('deja intactas las URLs sin parámetros o con parámetros válidos', () => {
    expect(stripRewriteParams('/api/info')).toBe('/api/info');
    expect(stripRewriteParams('/api/movements?productId=3&type=SALE')).toBe('/api/movements?productId=3&type=SALE');
  });
});
