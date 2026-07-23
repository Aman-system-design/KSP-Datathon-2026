import { render, screen, waitFor } from '@testing-library/react';
import { expect, test } from 'vitest';

import { BrandProvider, usePlatformBrand } from './BrandProvider.jsx';

function Probe() {
  const brand = usePlatformBrand();
  return <span>{brand.organizationName} — {brand.productTagline}</span>;
}

test('provides defaults, resolves overrides and owns the document title', async () => {
  render(<BrandProvider override={{ organizationName: 'Kerala Police', documentTitle: 'Kerala ACE' }}><Probe /></BrandProvider>);
  expect(screen.getByText('Kerala Police — Analytics · Crime · Enforcement')).toBeInTheDocument();
  await waitFor(() => expect(document.title).toBe('Kerala ACE'));
});
